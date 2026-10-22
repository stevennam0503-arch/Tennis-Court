package com.courtly.service;

import static com.courtly.util.Rules.*;
import com.courtly.entity.*;
import com.courtly.repository.*;
import com.courtly.dto.request.PaymentRequest;
import java.util.*;
import java.time.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Bank notifications are separate from a customer's declaration of transfer. */
@Service @RequiredArgsConstructor @Transactional
public class TransferService {
  private final DocumentService docs;
  private final CustomerOrderRepository orders;
  private final TournamentRegistrationRepository registrations;
  private final AccountRepository accounts;
  private final PaymentService payments;
  private final OrderService booking;
  private final MembershipService memberships;
  @Value("${courtly.payment.mode:MANUAL}") private String mode;
  @Value("${courtly.payment.bank-bin:}") private String bankBin;
  @Value("${courtly.payment.account-number:}") private String accountNumber;
  @Value("${courtly.payment.account-name:}") private String accountName;
  @Value("${courtly.payment.webhook-key:}") private String webhookKey;
  @Value("${courtly.admin-email}") private String adminEmail;

  public Map<String,Object> config() {return map("mode",mode,"bankConfigured",configured(),"bankBin",bankBin,"accountNumber",accountNumber,"accountName",accountName);}
  private boolean configured(){return bankBin.matches("\\d{6}") && accountNumber.matches("\\d{5,30}") && !accountName.isBlank();}
  private BigDecimal amount(Object n){var v=PresentationService.decimal(n);require(v.signum()>0 && v.stripTrailingZeros().scale()<=0,"Số tiền phải là số nguyên VND dương");return v;}
  private void own(Account a, Object owner){if(owner==null || !a.getId().toString().equals(owner.toString()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Giao dịch không thuộc tài khoản của bạn");}
  public List<Map<String,Object>> mine(Account a){docs.mutationLock();return docs.list("transfer:").stream().filter(x->a.getId().toString().equals(x.get("accountId"))).map(this::view).toList();}
  private Map<String,Object> view(Map<String,Object> x){var v=new LinkedHashMap<>(x);if(Set.of("PENDING","CHECKING").contains(x.get("status")) && Instant.parse((String)x.get("expiresAt")).isBefore(Instant.now()))v.put("status","EXPIRED");return v;}

  public Map<String,Object> create(Account a,Map<String,Object> b){
    docs.mutationLock(); booking.expireHolds();
    String type=oneOf((String)b.get("type"),"ORDER","TOURNAMENT","MEMBERSHIP"),target=text((String)b.get("targetId"),"Mã đơn");
    String purpose="BALANCE".equals(b.get("purpose"))?"BALANCE":"DEPOSIT";
    BigDecimal due;Instant expires=Instant.now().plusSeconds(900);
    if(type.equals("ORDER")){
      var o=orders.findForUpdate(UUID.fromString(target)).orElseThrow();own(a,o.getCustomerAccount()==null?null:o.getCustomerAccount().getId());
      require(Set.of("HOLDING","CONFIRMED","CHECKED_IN","COMPLETED").contains(o.getStatus()),"Đơn không nhận thanh toán mới");
      due=(purpose.equals("DEPOSIT")?o.getDepositRequired():o.getTotalAmount()).subtract(o.getPaidAmount());
      if(due.signum()<=0)due=o.getTotalAmount().subtract(o.getPaidAmount());
      if(o.getStatus().equals("HOLDING"))expires=o.getHoldExpiresAt();
    }else if(type.equals("TOURNAMENT")){
      var r=registrations.findForUpdate(UUID.fromString(target)).orElseThrow();own(a,r.getAccount().getId());
      require(!"CANCELLED".equals(r.getStatus())&&!"CANCELLED".equals(r.getTournament().getStatus()),"Đăng ký đã hủy");
      due=r.getTournament().getRegistrationFee().subtract(payments.registrationPaid(r.getId()));
    }else{
      var m=docs.get("membership:"+target);own(a,m.get("accountId"));require("PENDING".equals(m.get("status")),"Gói đã được xử lý");due=amount(m.get("price")).subtract(membershipReceived(target));
    }
    require(due.signum()>0,"Không còn khoản cần thanh toán");
    for(var old:mine(a))if(type.equals(old.get("type"))&&target.equals(old.get("targetId"))&&Set.of("PENDING","CHECKING").contains(old.get("status"))&&due.compareTo(PresentationService.decimal(old.get("remaining")))==0)return old;
    String id=UUID.randomUUID().toString(),reference="CT"+id.replace("-","").substring(0,16).toUpperCase(Locale.ROOT);
    var intent=map("id",id,"accountId",a.getId().toString(),"type",type,"targetId",target,"amount",due,"remaining",due,"received",0,"reviewAmount",0,"reference",reference,"status","PENDING","mode",mode,"createdAt",Instant.now().toString(),"expiresAt",expires.toString());
    intent.putAll(config());
    if(mode.equals("SANDBOX"))intent.put("qrPayload","courtly-sandbox:"+reference+":"+due.toPlainString());
    else if(configured())intent.put("qrPayload",vietQr(reference,due));
    docs.put("transfer:"+id,intent);return intent;
  }
  public Map<String,Object> declared(Account a,String id){docs.mutationLock();var x=docs.get("transfer:"+id);own(a,x.get("accountId"));if("PENDING".equals(view(x).get("status"))){x.put("status","CHECKING");docs.put("transfer:"+id,x);}return view(x);}
  public Map<String,Object> sandbox(Account a,String id,Map<String,Object> b){
    if(!mode.equals("SANDBOX"))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    docs.mutationLock();var x=docs.get("transfer:"+id);own(a,x.get("accountId"));
    require("SANDBOX".equals(x.get("mode")),"Không mô phỏng giao dịch thật");
    String scenario=oneOf((String)b.get("scenario"),"SUCCESS","PARTIAL","DUPLICATE","LATE");
    String event="sandbox:"+id+":"+scenario;
    if(!docs.get("bank-event:"+event).isEmpty())return docs.get("transfer:"+id);
    if(scenario.equals("LATE")){
      require("ORDER".equals(x.get("type")),"Kịch bản hết hạn áp dụng đơn sân");var o=orders.findForUpdate(UUID.fromString((String)x.get("targetId"))).orElseThrow();
      require("HOLDING".equals(o.getStatus()),"Chỉ mô phỏng hết hạn đơn đang giữ");o.setHoldExpiresAt(Instant.now().minusSeconds(1));orders.flush();booking.expireHolds();x.put("expiresAt",Instant.now().minusSeconds(1).toString());docs.put("transfer:"+id,x);
    }
    var due=PresentationService.decimal(x.get("remaining"));require(due.signum()>0,"Giao dịch đã thu đủ");
    if(scenario.equals("PARTIAL"))due=due.divide(BigDecimal.valueOf(2),0,RoundingMode.DOWN).max(BigDecimal.ONE);
    receive(event,(String)x.get("reference"),due,"SANDBOX");
    if(scenario.equals("DUPLICATE"))receive(event,(String)x.get("reference"),due,"SANDBOX");
    return view(docs.get("transfer:"+id));
  }
  public Map<String,Object> webhook(String authorization,Map<String,Object> b){
    if(!mode.equals("LIVE")||webhookKey.isBlank()||authorization==null||!MessageDigest.isEqual(("Apikey "+webhookKey).getBytes(StandardCharsets.UTF_8),authorization.getBytes(StandardCharsets.UTF_8)))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    require(configured() && accountNumber.equals(String.valueOf(b.get("accountNumber"))),"Sai tài khoản nhận");
    if(!"in".equals(b.get("transferType")))return map("success",true,"ignored",true);
    String providerId=String.valueOf(b.getOrDefault("id",""));
    require(providerId.matches("[0-9]{1,30}"),"Mã giao dịch ngân hàng không hợp lệ");
    String event="sepay:"+providerId;
    var matcher=java.util.regex.Pattern.compile("(?<![A-Z0-9])CT[A-F0-9]{16}(?![A-Z0-9])").matcher(String.valueOf(b.get("content")).toUpperCase(Locale.ROOT));
    String ref=matcher.find()?matcher.group():"UNMATCHED";
    receive(event,ref,amount(b.get("transferAmount")),"LIVE");return map("success",true);
  }
  private void receive(String event,String reference,BigDecimal received,String source){
    docs.mutationLock();var prior=docs.get("bank-event:"+event);
    if(!prior.isEmpty()){require(reference.equals(prior.get("reference"))&&received.compareTo(PresentationService.decimal(prior.get("amount")))==0,"Mã giao dịch lặp với nội dung khác");return;}
    var x=docs.list("transfer:").stream().filter(i->reference.equals(i.get("reference"))&&source.equals(i.get("mode"))).findFirst().orElse(null);
    var record=map("id",event,"reference",reference,"amount",received,"receivedAt",Instant.now().toString(),"status","REVIEW","source",source);
    if(x==null){docs.put("bank-event:"+event,record);return;}
    booking.expireHolds();
    boolean valid=Instant.parse((String)x.get("expiresAt")).isAfter(Instant.now())&&Set.of("PENDING","CHECKING").contains(x.get("status"));
    BigDecimal due=PresentationService.decimal(x.get("remaining"));String type=(String)x.get("type"),target=(String)x.get("targetId");
    if(type.equals("ORDER")){var o=orders.findForUpdate(UUID.fromString(target)).orElseThrow();valid&=Set.of("HOLDING","CONFIRMED","CHECKED_IN","COMPLETED").contains(o.getStatus());due=due.min(o.getTotalAmount().subtract(o.getPaidAmount()));}
    if(type.equals("TOURNAMENT")){var r=registrations.findForUpdate(UUID.fromString(target)).orElseThrow();valid&=!"CANCELLED".equals(r.getStatus())&&!"CANCELLED".equals(r.getTournament().getStatus());due=due.min(r.getTournament().getRegistrationFee().subtract(payments.registrationPaid(r.getId())));}
    if(type.equals("MEMBERSHIP")){var m=docs.get("membership:"+target);valid&="PENDING".equals(m.get("status"));due=due.min(PresentationService.decimal(m.get("price")).subtract(membershipReceived(target)));}
    valid&=received.compareTo(due)<=0&&due.signum()>0;
    if(valid){
      if(type.equals("MEMBERSHIP")){
        var total=membershipReceived(target).add(received);
        if(total.compareTo(PresentationService.decimal(docs.get("membership:"+target).get("price")))==0){var admin=accounts.findByEmailIgnoreCase(adminEmail).orElseThrow();memberships.action(admin,"POST","/api/membership/requests/"+target+"/activate",map("collected",true,"amount",total,"method","BANK_TRANSFER","transactionCode",event,"requestId",event));}
      }else payments.collect(new PaymentRequest(type.equals("ORDER")?UUID.fromString(target):null,type.equals("TOURNAMENT")?UUID.fromString(target):null,received,"BANK_TRANSFER",event));
      x.put("received",PresentationService.decimal(x.get("received")).add(received));x.put("remaining",PresentationService.decimal(x.get("remaining")).subtract(received));
      x.put("status",PresentationService.decimal(x.get("remaining")).signum()==0?"CONFIRMED":"CHECKING");record.put("status","APPLIED");
    }else{
      x.put("reviewAmount",PresentationService.decimal(x.get("reviewAmount")).add(received));x.put("status","REVIEW");
      if(type.equals("ORDER")){var o=orders.findForUpdate(UUID.fromString(target)).orElseThrow();var meta=docs.decode(o.getMetadata());meta.put("financialReview","MANUAL_REVIEW");meta.put("transferReviewAmount",PresentationService.decimal(meta.get("transferReviewAmount")).add(received));o.setMetadata(docs.encode(meta));}
    }
    record.put("intentId",x.get("id"));docs.put("bank-event:"+event,record);docs.put("transfer:"+x.get("id"),x);
  }
  private BigDecimal membershipReceived(String target){return docs.list("transfer:").stream().filter(x -> "MEMBERSHIP".equals(x.get("type")) && target.equals(x.get("targetId"))).map(x -> PresentationService.decimal(x.get("received"))).reduce(BigDecimal.ZERO,BigDecimal::add);}
  private static String tlv(String id,String s){return id+String.format(Locale.ROOT,"%02d",s.length())+s;}
  private String vietQr(String reference,BigDecimal amount){
    String merchant=tlv("00","A000000727")+tlv("01",tlv("00",bankBin)+tlv("01",accountNumber))+tlv("02","QRIBFTTA");
    String payload=tlv("00","01")+tlv("01","12")+tlv("38",merchant)+tlv("53","704")+tlv("54",amount.setScale(0).toPlainString())+tlv("58","VN")+tlv("62",tlv("08",reference))+"6304";
    int crc=0xffff;for(byte v:payload.getBytes(StandardCharsets.UTF_8)){crc^=(v&255)<<8;for(int i=0;i<8;i++)crc=(crc&0x8000)!=0?(crc<<1)^0x1021:crc<<1;crc&=0xffff;}
    return payload+String.format(Locale.ROOT,"%04X",crc);
  }
}
