package com.courtly.controller;
import static com.courtly.util.Rules.*;
import com.courtly.service.*;
import com.courtly.repository.*;
import com.courtly.dto.request.RegistrationRequest;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
@RestController @RequiredArgsConstructor
public class GuestController {
 private final AuthService auth;private final RequestService requests;private final TournamentService tournaments;private final TournamentRepository tournamentRepo;private final JdbcTemplate jdbc;private final DocumentService docs;
 @PostMapping("/api/guest/tournaments/{id}/register") @Transactional
 public Map<String,Object> register(@PathVariable UUID id,@RequestBody Map<String,Object>b,HttpServletRequest req){
  var a=auth.current(req);
  return requests.execute(a.getId(),(String)b.get("requestId"),"guest-register:"+id,b,()->{
   require(Boolean.TRUE.equals(b.get("adult"))&&Boolean.TRUE.equals(b.get("rules")),"Cần xác nhận đủ 18 tuổi và đồng ý điều lệ");
   String phone=text((String)b.get("phone"),"Điện thoại");require(phone.matches("\\+?[0-9 ()-]{9,20}"),"Điện thoại không hợp lệ");
   String name=text((String)b.get("name"),"Tên người chơi");require(name.length()<=100,"Tên quá dài");
   var t=tournamentRepo.findForUpdate(id).orElseThrow();
   var emails=new ArrayList<String>();emails.add(a.getEmail().toLowerCase(Locale.ROOT));var extra=new ArrayList<String>();
   if(!"SINGLES".equals(t.getFormat())){
    String mate=text((String)b.get("partnerName"),"Tên đồng đội"),email=text((String)b.get("partnerEmail"),"Email đồng đội").toLowerCase(Locale.ROOT);
    require(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")&&email.length()<=254,"Email đồng đội không hợp lệ");
    require(!email.equalsIgnoreCase(a.getEmail()),"Hai người chơi phải khác nhau");extra.add(mate);emails.add(email);
   }
   for(String email:emails)require(jdbc.queryForObject("SELECT count(*) FROM team_members m LEFT JOIN accounts a ON a.id=m.account_id WHERE m.tournament_id=? AND (lower(m.email)=? OR lower(a.email)=?)",Integer.class,id,email,email)==0,"Người chơi đã đăng ký giải này");
   UUID reg=tournaments.register(id,new RegistrationRequest(a.getId(),"SINGLES".equals(t.getFormat())?name:text((String)b.get("teamName"),"Tên đội"),extra));
   var members=jdbc.queryForList("SELECT id,account_id FROM team_members WHERE registration_id=? ORDER BY account_id NULLS LAST",reg);
   for(var m:members)jdbc.update("UPDATE team_members SET email=? WHERE id=?",m.get("account_id")!=null?emails.get(0):emails.get(1),m.get("id"));
   docs.put("registration-details:"+reg,map("id",reg,"accountId",a.getId(),"name",name,"phone",phone,"consentedAt",java.time.Instant.now().toString(),"adult",true));
   return map("id",reg);
  });
 }
}
