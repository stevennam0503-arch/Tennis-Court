import React, { useState } from 'react';
import { RotateCcw, Sparkles, CheckCircle2, ShieldAlert, Award, Calendar, Receipt, UserCheck } from 'lucide-react';
import { useCourtly } from '../context';
import { api } from '../services/api';
import { Title, Panel, Table, Button, Tabs, Modal } from '../components/UI';
import { PolicyNotice } from '../components/OrderSummary';
import modules from '../modules.json';

const pending = [], partial = [6, 18, 39, 40, 42, 44, 47, 49, 50];

const SHOWCASE_ORDERS = [
  { code: 'CT-11111111', court: 'Sân A01', time: 'hôm nay, từ giờ reset đến +1,5 giờ', customer: 'Trần Hoàng Nam (Plus)', status: 'CHECKED_IN', desc: 'Đang chơi, đã cọc 50% tiền sân sau ưu đãi 15%. Demo check-out: hệ thống tính phần còn lại, thu tiền mặt rồi check-out.' },
  { code: 'CT-14141414', court: 'Sân V01', time: 'hôm nay, 1 giờ trước đến 1 giờ sau', customer: 'Trần Hoàng Nam (Plus)', status: 'CHECKED_IN', desc: 'Đã gia hạn +30 phút, phí gia hạn bằng giá slot cuối; ưu đãi Plus 10% cho sân VIP.' },
  { code: 'CT-12121212', court: 'Sân A04', time: 'hôm nay, sắp hết giờ', customer: 'Lê Thị Thảo (Club)', status: 'CHECKED_IN', desc: 'Cảnh báo sắp hết giờ; ưu đãi Club 10%.' },
  { code: 'CT-13131313', court: 'Sân B04', time: 'hôm nay, vừa hết giờ', customer: 'Đặng Hoàng Long', status: 'CHECKED_IN', desc: 'Đơn trong thời gian ân hạn 15 phút, cần check-out.' },
  { code: 'CT-22222222', court: 'Sân B01', time: 'hôm nay 19:00 - 21:00', customer: 'Lê Thu Hà', status: 'CONFIRMED', desc: 'Đã cọc 50%. Demo vé điện tử và quét QR check-in.' },
  { code: 'CT-77777777', court: 'Sân V02', time: 'hôm nay 17:00 - 19:00', customer: 'Đặng Hoàng Long', status: 'CONFIRMED', desc: 'Thuê trọng tài TT Phạm Quốc Huy 2 ca (17:00 - 18:00, 18:00 - 19:00); tổng = tiền sân + phí trọng tài.' },
  { code: 'CT-26262626', court: 'Sân A01', time: 'ngày mai 08:00 - 10:00', customer: 'Phạm Minh Đức', status: 'CONFIRMED', desc: 'Khách đã trả trước 100%.' },
  { code: 'CT-33333333', court: 'Sân V01', time: 'ngày mai 10:00 - 12:00', customer: 'Nguyễn Văn Tuấn (khách lẻ tại quầy)', status: 'HOLDING', desc: 'Giữ chỗ 5 phút tính từ lúc reset; quá hạn thì sân tự nhả. Reset ngay trước khi demo phần này.' },
  { code: 'CT-44444444', court: 'Sân B02', time: '16:00 - 18:00, 4 tuần liên tiếp', customer: 'Trần Hoàng Nam (Plus)', status: 'CONFIRMED', desc: 'Đặt định kỳ 4 tuần, 16 slot; cọc 50% của cả chuỗi sau ưu đãi 15%.' },
  { code: 'CT-81818181', court: 'Sân A03', time: '2 ngày trước 16:00 - 18:00', customer: 'Lê Thị Thảo (Club)', status: 'CHECKED_IN', desc: 'Quá hạn, còn nợ 50%: xuất hiện ở tab đơn chưa thu tiền.' },
  { code: 'CT-82828282', court: 'Sân V02', time: 'hôm qua 17:00 - 19:00', customer: 'Đặng Hoàng Long', status: 'CHECKED_IN', desc: 'Có trọng tài, còn nợ phần còn lại; khách bị chặn đặt đơn mới tới khi trả nợ.' },
  { code: 'CT-83838383', court: 'Sân A01', time: '2 ngày trước 18:00 - 20:00', customer: 'Phạm Minh Đức', status: 'CHECKED_IN', desc: 'Đã thu đủ 100% nhưng quên check-out: nằm ở tab cần check-out.' },
  { code: 'CT-55555555', court: 'Sân A02', time: 'hôm qua 17:00 - 19:00', customer: 'Phạm Minh Đức', status: 'COMPLETED', desc: 'Đã hoàn tất, có hóa đơn INV-<ngày hôm qua>-001. Demo in phiếu thu K80/A4.' },
  { code: 'CT-91919191', court: 'Sân A02', time: 'tuần sau 17:00 - 19:00', customer: 'Vũ Mai Phương', status: 'CANCELLED', desc: 'Hủy trước hơn 24 giờ → chờ hoàn 100% cọc (Admin duyệt chi).' },
  { code: 'CT-92929292', court: 'Sân B03', time: 'ngày mai 06:00 - 08:00', customer: 'Đặng Hoàng Long', status: 'CANCELLED', desc: 'Hủy lúc 06:30 hôm nay, 23,5 giờ trước giờ chơi → chờ hoàn 50% cọc.' },
  { code: 'CT-93939393', court: 'Sân A03', time: 'hôm nay 11:00 - 13:00', customer: 'Lê Thu Hà', status: 'CANCELLED', desc: 'Hủy lúc 09:00, 2 giờ trước giờ chơi → không hoàn, CLB giữ 100% cọc.' },
  { code: 'CT-66666666', court: 'Sân A03', time: '2 ngày trước 18:00 - 20:00', customer: 'Vũ Mai Phương', status: 'CANCELLED', desc: 'Hủy 16 giờ trước giờ chơi → hoàn 50% cọc, Admin đã chi. Thấy dòng hoàn tiền trong Lịch sử thanh toán.' }
];

export default function SystemPage() {
  const { data, show, notify, refresh } = useCourtly();
  const demoEnabled = data.demoResetEnabled === true;
  const [tab, setTab] = useState('modules');
  const [resetModal, setResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetDemo = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const res = await api('/catalog/demo-reset', 'POST', {});
      notify(res?.message || 'Đã khôi phục thành công bộ dữ liệu chuẩn Hội đồng!');
      setResetModal(false);
      await refresh();
    } catch (e) {
      notify(e.message || 'Không thể đặt lại dữ liệu. Vui lòng thử lại.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Title
        subtitle="Đối chiếu phạm vi 50 module, quản trị hệ thống và kiểm soát dữ liệu trình diễn Hội đồng."
        action={demoEnabled &&
          <Button
            className="primary"
            onClick={() => setResetModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', borderColor: '#0f172a' }}
          >
            <RotateCcw size={15} /> Đặt lại dữ liệu mẫu Hội đồng
          </Button>
        }
      >
        Hệ thống & module
      </Title>

      <Tabs
        options={[
          ['modules', '50 module'],
          ...(demoEnabled ? [['demo', 'Dữ liệu mẫu Hội đồng']] : []),
          ['audit', 'Nhật ký'],
          ['settings', 'Chính sách']
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'modules' && (
        <>
          
          <Panel title="50 module từ tài liệu">
            <Table headings={['#', 'Module', 'Phạm vi', 'Ưu tiên']}>
              {modules.map(m => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td>
                    <span className="name">{m.name}</span>
                    <small>{m.group}</small>
                    <small style={{ maxWidth: 570 }}>{m.description}</small>
                  </td>
                  <td>
                    <span className={`chip ${pending.includes(m.id) ? 'orange' : partial.includes(m.id) ? 'blue' : 'green'}`}>
                      {pending.includes(m.id) ? 'Chưa kết nối' : partial.includes(m.id) ? 'Bản cơ bản' : 'Đã có thao tác'}
                    </span>
                  </td>
                  <td>{m.priority}</td>
                </tr>
              ))}
            </Table>
          </Panel>
        </>
      )}

      {demoEnabled && tab === 'demo' && (
        <>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: '20px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontWeight: 700, fontSize: 16 }}>
                  <Sparkles size={18} style={{ color: '#eab308' }} /> Bộ dữ liệu chuẩn trình diễn Hội đồng (Golden Showcase Dataset)
                </div>
                <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 13, maxWidth: 680 }}>
                  Công cụ 1-click chuyên dụng cho buổi bảo vệ. Khi thầy cô Hội đồng yêu cầu thao tác thử nghiệm (tạo đơn mới, check-in, hủy đơn, thuê trọng tài...), bạn có thể nhấn nút đặt lại bất cứ lúc nào để xóa sạch dữ liệu phát sinh và đưa hệ thống về đúng 7 đơn hàng mẫu chuẩn.
                </p>
              </div>
              <Button
                className="primary"
                disabled={resetting}
                onClick={() => setResetModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontSize: 14 }}
              >
                <RotateCcw size={16} /> {resetting ? 'Đang đặt lại…' : 'Đặt lại dữ liệu mẫu ngay'}
              </Button>
            </div>
          </div>

          <Panel title="Danh sách 17 đơn hàng mẫu (Golden Orders)">
            <Table headings={['Mã đơn', 'Sân & Giờ chơi', 'Khách hàng', 'Trạng thái', 'Mục đích trình diễn Hội đồng']}>
              {SHOWCASE_ORDERS.map(o => (
                <tr key={o.code}>
                  <td><b>#{o.code}</b></td>
                  <td>
                    <div>{o.court}</div>
                    <small style={{ color: '#64748b' }}>{o.time}</small>
                  </td>
                  <td>{o.customer}</td>
                  <td><span className={`chip ${o.status === 'CHECKED_IN' ? 'blue' : o.status === 'CONFIRMED' ? 'green' : o.status === 'HOLDING' ? 'orange' : o.status === 'COMPLETED' ? 'gray' : 'red'}`}>{o.status}</span></td>
                  <td><small style={{ color: '#334155' }}>{o.desc}</small></td>
                </tr>
              ))}
            </Table>
          </Panel>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                <Award size={18} style={{ color: '#2563eb' }} /> Giải đấu Courtly Winter Doubles
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                4 cặp vận động viên đã đóng đủ lệ phí 350.000₫/đội. Sẵn sàng bốc thăm chia nhánh và cập nhật tỉ số trực tiếp.
              </p>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                <UserCheck size={18} style={{ color: '#16a34a' }} /> Hội viên VIP Plus (Trần Hoàng Nam)
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Gói Plus có hiệu lực 60 ngày, giảm tự động 15% tiền sân khi đặt lịch (đã ghi nhận doanh thu membership 499.000₫).
              </p>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                <Sparkles size={18} style={{ color: '#8b5cf6' }} /> Tự do kiểm thử đăng ký tài khoản
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Toàn bộ tài khoản bạn tự tạo trong lúc thử nghiệm sẽ được <b>tự động xóa sạch và giải phóng email</b> mỗi khi bấm đặt lại dữ liệu.
              </p>
            </div>
          </div>
        </>
      )}

      {tab === 'audit' && (
        <Panel title="100 thao tác gần nhất">
          <Table headings={['Thời điểm', 'Người thao tác', 'Hành động', 'Chi tiết']} empty={!data.audit.length}>
            {data.audit.map(a => (
              <tr key={a.id}>
                <td>{new Date(a.at).toLocaleString('vi-VN')}</td>
                <td>{a.actor}</td>
                <td>{a.action}</td>
                <td>
                  {a.detail}
                  {a.reason && <small>Lý do: {a.reason}</small>}
                  <details>
                    <summary>Trước / sau</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', maxWidth: 500, maxHeight: 300, overflow: 'auto' }}>
                      {JSON.stringify({ before: a.before, after: a.after }, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {tab === 'settings' && (
        <Panel title="Chính sách giữ chỗ">
          <div className="panel-body">
            <div className="summary-line">
              <span>Thời gian giữ chỗ</span>
              <b>{data.settings.holdMinutes} phút</b>
            </div>
            <div className="summary-line">
              <span>Tiền cọc</span>
              <b>{data.settings.depositPercent}%</b>
            </div>
            <div className="summary-line">
              <span>Tỷ lệ tiền chờ hoàn</span>
              <b>{data.settings.cancelRefundPercent}%</b>
            </div>
            <p className="subtitle" style={{ margin: '14px 0' }}>
              Khách hủy hợp lệ được tính khoản chờ hoàn theo tỷ lệ này. Nhân viên có thẩm quyền vẫn phải thực hiện và ghi nhận tiền hoàn.
            </p>
            <PolicyNotice />
            <Button className="primary" onClick={() => show({ type: 'settings' })}>
              Sửa chính sách
            </Button>
          </div>
        </Panel>
      )}

      {/* Confirmation Modal */}
      {demoEnabled && resetModal && (
        <Modal
          title="Xác nhận đặt lại dữ liệu chuẩn Hội đồng"
          onClose={() => !resetting && setResetModal(false)}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <Button disabled={resetting} onClick={() => setResetModal(false)}>
                Hủy bỏ
              </Button>
              <Button
                className="primary"
                disabled={resetting}
                onClick={handleResetDemo}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#b91c1c', borderColor: '#b91c1c' }}
              >
                <RotateCcw size={15} /> {resetting ? 'Đang thực hiện…' : 'Xác nhận đặt lại dữ liệu'}
              </Button>
            </div>
          }
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <ShieldAlert size={22} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
                <b>Lưu ý quan trọng cho buổi bảo vệ Hội đồng:</b>
                <div style={{ marginTop: 4 }}>
                  Toàn bộ các đơn hàng phát sinh và <b>toàn bộ tài khoản bạn tự tạo trong lúc thử nghiệm</b> sẽ được xóa sạch hoàn toàn để giải phóng email. Hệ thống sẽ tái tạo lại chính xác <b>7 đơn hàng mẫu chuẩn</b>, <b>1 giải đấu 4 đội</b> và <b>1 khách hàng VIP Plus</b> để bảng biểu doanh thu và kịch bản thuyết trình luôn đạt độ hoàn hảo cao nhất.
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#334155' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Sau khi đặt lại, hệ thống sẽ chứa:</div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><b>17 đơn hàng mẫu:</b> đang chơi, đã gia hạn, sắp hết giờ, ân hạn, sắp đến, giữ chỗ 5 phút, định kỳ 4 tuần, nợ quá hạn, chờ check-out, hoàn tất có hóa đơn, thuê trọng tài, hủy hoàn cọc theo 3 mốc (100% / 50% / 0%). Số tiền được tính lại theo bảng giá hiện hành.</li>
                <li><b>4 tài khoản hệ thống chuẩn:</b> <code>admin@gmail.com</code> (123456), <code>staff@gmail.com</code> (123456), <code>hoangnam@gmail.com</code> (123456), <code>khachmoi@gmail.com</code> (123456).</li>
                <li><b>Tài khoản tự tạo:</b> Đã được xóa hoàn toàn và giải phóng email để bạn sẵn sàng đăng ký lại từ đầu!</li>
                <li><b>Báo cáo tài chính:</b> 3 trụ cột (Tiền sân, Trọng tài, Giải đấu & Membership) khớp từng đồng.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
