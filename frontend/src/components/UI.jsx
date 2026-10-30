import React, { useEffect, useRef, useState } from 'react';
import { labels } from '../utils/format';

export function Button({ children, className = '', ...props }) {
  return <button type="button" className={`btn ${className}`} {...props}>{children}</button>;
}
export function Title({ children, subtitle, action }) {
  return <div className="title-row"><div><h1>{children}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{action}</div>;
}
export function Panel({ title, action, children }) {
  return <section className="panel"><div className="panel-head"><h2>{title}</h2>{action}</div>{children}</section>;
}
export function Stat({ title, value, note, icon: Icon }) {
  return <div className="stat"><div className="stat-top">{title}{Icon && <span className="stat-icon"><Icon size={19}/></span>}</div><div className="number">{value}</div><div className="note">{note}</div></div>;
}
export function Chip({ status }) {
  const color = ['ACTIVE','CONFIRMED','COMPLETED','OPEN','FINISHED'].includes(status) ? 'green' : ['HOLDING','PENDING','MAINTENANCE'].includes(status) ? 'orange' : ['CANCELLED','EXPIRED','INACTIVE','LOCKED'].includes(status) ? 'red' : ['CHECKED_IN','BOOKED'].includes(status) ? 'blue' : '';
  return <span className={`chip ${color}`}>{labels[status] || status}</span>;
}
export function Table({ headings, children, empty }) {
  return <div className="table-wrap"><table><thead><tr>{headings.map((h,i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{empty ? <tr><td className="empty" colSpan={headings.length}>Chưa có dữ liệu</td></tr> : children}</tbody></table></div>;
}
export function Tabs({ options, value, onChange }) {
  return <div className="tabs" role="tablist">{options.map(([id,text]) => <button role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} key={id} onClick={() => onChange(id)}>{text}</button>)}</div>;
}
export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('input,select,button,textarea')?.focus();
    const handler = e => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const items = [...ref.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(x => !x.disabled);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="close" onClick={onClose} aria-label="Đóng">×</button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</section></div>;
}
export function FormDialog({ title, fields, initial = {}, onSubmit, onClose, children, submitText = 'Lưu thông tin', onChange, wide = false, onDelete, deleteText = 'Xóa' }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const submit = async e => {
    e.preventDefault(); if (saving || deleting) return;
    setSaving(true); setError('');
    try { await onSubmit(values); } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const change = (name, value) => setValues(previous => {
    const next = { ...previous, [name]: value };
    return onChange ? onChange(next, name) : next;
  });
  const executeDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete();
    } catch (e) {
      setError(e.message || 'Không thể xóa');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };
  return <Modal title={title} onClose={onClose} wide={wide} footer={<>{onDelete && (confirmDelete ? (
    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 'auto' }}>
      <span style={{ color: '#e11d48', fontSize: 13, fontWeight: 600 }}>Xác nhận xóa sân?</span>
      <button type="button" className="btn danger" disabled={deleting} style={{ background: '#e11d48', color: '#fff', borderColor: '#be123c', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700 }} onClick={executeDelete}>{deleting ? 'Đang xóa…' : 'Xác nhận xóa'}</button>
      <button type="button" className="btn sm" disabled={deleting} onClick={() => setConfirmDelete(false)}>Hủy</button>
    </div>
  ) : (
    <button type="button" className="btn danger" style={{ marginRight: 'auto', background: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3', minHeight: 38, padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13 }} onClick={() => setConfirmDelete(true)}>{deleteText}</button>
  ))}<Button onClick={onClose} disabled={deleting || saving}>Đóng</Button><button type="submit" form="dialog-form" className="btn primary" disabled={saving || deleting}>{saving ? 'Đang lưu…' : submitText}</button></>}>
    {children}<form id="dialog-form" onSubmit={submit}><div className="form-grid">{fields.map(f => {
      const choices = typeof f.options === 'function' ? f.options(values) : f.options;
      return <div key={f.name} className={`field ${f.full ? 'full' : ''}`}><label htmlFor={`field-${f.name}`}>{f.label}</label>{choices ? <select id={`field-${f.name}`} disabled={f.disabled} required={f.required !== false} value={values[f.name] ?? ''} onChange={e => change(f.name,e.target.value)}>{choices.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select> : f.type === 'textarea' ? <textarea id={`field-${f.name}`} value={values[f.name] ?? ''} required={f.required !== false} onChange={e => change(f.name,e.target.value)}/> : <input id={`field-${f.name}`} readOnly={f.readOnly} disabled={f.disabled} type={f.type || 'text'} value={values[f.name] ?? ''} min={f.min} max={f.max} maxLength={f.maxLength || 255} step={f.type === 'number' ? (f.step || 1) : undefined} required={f.required !== false} onChange={e => change(f.name,f.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}/>}</div>;
    })}</div></form>{error && <div className="error" role="alert">{error}</div>}
  </Modal>;
}
