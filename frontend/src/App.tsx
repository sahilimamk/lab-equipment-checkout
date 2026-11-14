import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, formatDate, SEED_USERS, type Checkout, type Equipment, type ReportRow, type User } from './api';

type Tab = 'equipment' | 'mine' | 'report';
type Status = 'idle' | 'loading' | 'error' | 'empty' | 'ready';

export default function App() {
  const [user, setUser] = useState<User>(SEED_USERS[0]);
  const [tab, setTab] = useState<Tab>('equipment');

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [eqStatus, setEqStatus] = useState<Status>('idle');
  const [eqError, setEqError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'ok' | 'error'>('ok');
  // In-flight ids guard Borrow / Return / Retire against double-clicks.
  const [busy, setBusy] = useState<Set<string>>(new Set());

  function showNotice(text: string, kind: 'ok' | 'error' = 'ok') {
    setNotice(text);
    setNoticeKind(kind);
  }

  // Add-equipment form state (§5: client validation + inline server errors)
  const [name, setName] = useState('');
  const [units, setUnits] = useState('1');
  const [formErrors, setFormErrors] = useState<{ name?: string; units?: string }>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const [mine, setMine] = useState<Checkout[]>([]);
  const [mineStatus, setMineStatus] = useState<Status>('idle');
  const [mineError, setMineError] = useState('');
  const [minePage, setMinePage] = useState(1);
  const [mineTotalPages, setMineTotalPages] = useState(1);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [reportStatus, setReportStatus] = useState<Status>('idle');
  const [reportError, setReportError] = useState('');

  const loadEquipment = useCallback(async () => {
    setEqStatus('loading');
    setEqError('');
    try {
      const data = await api.listEquipment(user.id);
      setEquipment(data);
      setEqStatus(data.length === 0 ? 'empty' : 'ready');
    } catch (e) {
      setEqError(e instanceof ApiError ? e.message : 'Could not load equipment');
      setEqStatus('error');
    }
  }, [user.id]);

  const loadMine = useCallback(
    async (page = 1) => {
      setMineStatus('loading');
      setMineError('');
      try {
        const { data, pagination } = await api.listCheckouts(user.id, page, 10);
        setMine(data);
        setMinePage(pagination.page);
        setMineTotalPages(Math.max(1, pagination.total_pages));
        setMineStatus(data.length === 0 ? 'empty' : 'ready');
      } catch (e) {
        setMineError(e instanceof ApiError ? e.message : 'Could not load checkouts');
        setMineStatus('error');
      }
    },
    [user.id]
  );

  const loadReport = useCallback(async () => {
    setReportStatus('loading');
    setReportError('');
    try {
      const data = await api.report(user.id);
      setReport(data);
      setReportStatus(data.length === 0 ? 'empty' : 'ready');
    } catch (e) {
      setReportError(e instanceof ApiError ? e.message : 'Could not load report');
      setReportStatus('error');
    }
  }, [user.id]);

  useEffect(() => {
    setNotice('');
    loadEquipment();
    if (tab === 'mine') loadMine(1);
    if (tab === 'report') loadReport();
  }, [tab, loadEquipment, loadMine, loadReport]);

  function validateForm(): boolean {
    const errors: typeof formErrors = {};
    if (!name.trim()) errors.name = 'Name is required';
    // Digits only — rejects "1e3", " 2 ", "1.5"; backend also caps at 1000.
    if (!/^\d+$/.test(units.trim()) || Number(units) < 1 || Number(units) > 1000) {
      errors.units = 'Units must be a whole number from 1 to 1000';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitEquipment(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    setNotice('');
    if (!validateForm()) return;
    setSaving(true);
    try {
      const created = await api.createEquipment(user.id, name.trim(), Number(units));
      showNotice(`Added “${created.name}” (${created.total_units} units).`);
      setName('');
      setUnits('1');
      await loadEquipment();
    } catch (err) {
      // Server errors (e.g. duplicate name) shown inline, next to the form.
      setServerError(err instanceof ApiError ? err.message : 'Could not add equipment');
    } finally {
      setSaving(false);
    }
  }

  function markBusy(key: string) {
    setBusy((prev) => new Set(prev).add(key));
  }
  function clearBusy(key: string) {
    setBusy((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function borrow(eq: Equipment) {
    const key = `borrow-${eq.id}`;
    if (busy.has(key)) return;
    setNotice('');
    markBusy(key);
    try {
      await api.borrow(user.id, eq.id);
      showNotice(`Borrowed one ${eq.name}. Due in 7 days.`);
      await loadEquipment();
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : 'Borrow failed', 'error');
    } finally {
      clearBusy(key);
    }
  }

  async function returnOne(c: Checkout) {
    const key = `return-${c.id}`;
    if (busy.has(key)) return;
    setNotice('');
    markBusy(key);
    try {
      await api.returnCheckout(user.id, c.id);
      showNotice(`Returned ${c.equipment_name}.`);
      await loadMine(minePage);
      await loadEquipment();
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : 'Return failed', 'error');
    } finally {
      clearBusy(key);
    }
  }

  async function retire(eq: Equipment) {
    const key = `retire-${eq.id}`;
    if (busy.has(key)) return;
    setNotice('');
    markBusy(key);
    try {
      await api.retireEquipment(user.id, eq.id);
      showNotice(`Retired ${eq.name}. It can no longer be borrowed.`);
      await loadEquipment();
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : 'Retire failed', 'error');
    } finally {
      clearBusy(key);
    }
  }

  const isAssistant = user.role === 'assistant';
  const maxCheckedOut = Math.max(1, ...report.map((r) => r.checked_out));

  return (
    <main className="wrap">
      <header>
        <h1>Lab Equipment Checkout</h1>
        <p className="sub">Borrow lab gear. Return it in 7 days. Stock never goes below zero.</p>
        <label className="user-picker">
          Acting as:{' '}
          <select value={user.id} onChange={(e) => setUser(SEED_USERS.find((u) => u.id === e.target.value)!)}>
            {SEED_USERS.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
      </header>

      <nav className="tabs">
        <button className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>Equipment</button>
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>My checkouts</button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>Usage report</button>
      </nav>

      {notice && (
        <p className={noticeKind === 'error' ? 'notice notice-error' : 'notice'} role="status">
          {notice}
        </p>
      )}

      {tab === 'equipment' && (
        <section>
          {isAssistant && (
            <form className="card" onSubmit={submitEquipment} noValidate>
              <h2>Add equipment</h2>
              <label>
                Name
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFormErrors((p) => ({ ...p, name: undefined }));
                    setServerError('');
                  }}
                  placeholder="e.g. Oscilloscope"
                />
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </label>
              <label>
                Total units
                <input
                  value={units}
                  onChange={(e) => {
                    setUnits(e.target.value);
                    setFormErrors((p) => ({ ...p, units: undefined }));
                    setServerError('');
                  }}
                  inputMode="numeric"
                />
                {formErrors.units && <span className="field-error">{formErrors.units}</span>}
              </label>
              {serverError && <p className="field-error" role="alert">{serverError}</p>}
              <button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add equipment'}</button>
            </form>
          )}

          <h2>Equipment</h2>
          {eqStatus === 'loading' && <p>Loading equipment…</p>}
          {eqStatus === 'error' && (
            <p className="error-box">Could not load equipment: {eqError} <button onClick={loadEquipment}>Retry</button></p>
          )}
          {eqStatus === 'empty' && <p>No equipment yet. {isAssistant ? 'Add the first item above.' : 'Ask a lab assistant to add some.'}</p>}
          {eqStatus === 'ready' && (
            <ul className="eq-list">
              {equipment.map((eq) => (
                <li key={eq.id} className="card">
                  <strong>{eq.name}</strong>
                  {eq.retired && <span className="badge retired">Retired</span>}
                  <span>{eq.available_units} of {eq.total_units} available · {eq.checked_out} out</span>
                  <button
                    disabled={eq.available_units <= 0 || eq.retired || busy.has(`borrow-${eq.id}`)}
                    onClick={() => borrow(eq)}
                    title={eq.retired ? 'Retired — cannot borrow' : eq.available_units <= 0 ? 'None available' : 'Borrow one unit'}
                  >
                    {busy.has(`borrow-${eq.id}`)
                      ? 'Borrowing…'
                      : eq.retired
                        ? 'Retired'
                        : eq.available_units <= 0
                          ? 'Not available'
                          : 'Borrow'}
                  </button>
                  {isAssistant && !eq.retired && (
                    <button
                      className="secondary"
                      disabled={busy.has(`retire-${eq.id}`)}
                      onClick={() => retire(eq)}
                    >
                      Retire
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'mine' && (
        <section>
          <h2>My checkouts {user.role === 'assistant' ? '(all students — you are an assistant)' : ''}</h2>
          {mineStatus === 'loading' && <p>Loading your checkouts…</p>}
          {mineStatus === 'error' && (
            <p className="error-box">Could not load checkouts: {mineError} <button onClick={() => loadMine(minePage)}>Retry</button></p>
          )}
          {mineStatus === 'empty' && <p>You have no checkouts yet. Borrow something from the Equipment tab.</p>}
          {mineStatus === 'ready' && (
            <>
              <ul className="eq-list">
                {mine.map((c) => (
                  <li key={c.id} className="card">
                    <strong>{c.equipment_name}</strong>
                    <span>{c.user_name} · borrowed {formatDate(c.borrowed_at)}</span>
                    <span>Due {formatDate(c.due_at)}</span>
                    {c.returned_at ? (
                      <span className="badge returned">Returned {formatDate(c.returned_at)}</span>
                    ) : (
                      <>
                        {c.overdue && <span className="badge overdue">Overdue</span>}
                        <button disabled={busy.has(`return-${c.id}`)} onClick={() => returnOne(c)}>
                          {busy.has(`return-${c.id}`) ? 'Returning…' : 'Return'}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {mineTotalPages > 1 && (
                <p>
                  <button disabled={minePage <= 1} onClick={() => loadMine(minePage - 1)}>← Previous</button>{' '}
                  Page {minePage} of {mineTotalPages}{' '}
                  <button disabled={minePage >= mineTotalPages} onClick={() => loadMine(minePage + 1)}>Next →</button>
                </p>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'report' && (
        <section>
          <h2>Usage report</h2>
          <p className="sub">Checked out now, and how many of those are overdue. From one SQL JOIN + aggregate.</p>
          {reportStatus === 'loading' && <p>Loading report…</p>}
          {reportStatus === 'error' && (
            <p className="error-box">Could not load report: {reportError} <button onClick={loadReport}>Retry</button></p>
          )}
          {reportStatus === 'empty' && <p>No equipment yet, so there is nothing to report. Add equipment first.</p>}
          {reportStatus === 'ready' && (
            <>
              <p className="sub">
                <span className="legend-blue">■</span> Checked out &nbsp;
                <span className="legend-red">■</span> Overdue (part of checked out)
              </p>
              <div className="chart" aria-label="Checked-out units per item">
                {report.map((r) => (
                  <div key={r.equipment_id} className="bar-row">
                    <span className="bar-label">{r.name}</span>
                    <div className="bar-track">
                      <div className="bar" style={{ width: `${(r.checked_out / maxCheckedOut) * 100}%` }} />
                      {r.overdue > 0 && <div className="bar overdue-bar" style={{ width: `${(r.overdue / maxCheckedOut) * 100}%` }} />}
                    </div>
                    <span>{r.checked_out} out{r.overdue > 0 ? ` · ${r.overdue} overdue` : ''} · {r.available_units} free</span>
                  </div>
                ))}
              </div>
              <table className="report-table">
                <thead><tr><th>Equipment</th><th>Total</th><th>Checked out</th><th>Overdue</th><th>Available</th></tr></thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.equipment_id}>
                      <td>{r.name}</td><td>{r.total_units}</td><td>{r.checked_out}</td>
                      <td>{r.overdue}</td><td>{r.available_units}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
    </main>
  );
}
