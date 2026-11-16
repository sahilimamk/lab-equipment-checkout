import { useEffect, useState } from 'react';
import { ApiError, api, formatDate, SEED_USERS } from './api';
import type { Checkout, Equipment, ReportRow, User } from './api';

export default function App() {
  const [user, setUser] = useState<User>(SEED_USERS[0]);
  const [tab, setTab] = useState('equipment');

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [eqStatus, setEqStatus] = useState('loading');
  const [eqError, setEqError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [busyId, setBusyId] = useState('');

  const [name, setName] = useState('');
  const [units, setUnits] = useState('1');
  const [nameError, setNameError] = useState('');
  const [unitsError, setUnitsError] = useState('');
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const [mine, setMine] = useState<Checkout[]>([]);
  const [mineStatus, setMineStatus] = useState('loading');
  const [mineError, setMineError] = useState('');
  const [minePage, setMinePage] = useState(1);
  const [mineTotalPages, setMineTotalPages] = useState(1);

  const [report, setReport] = useState<ReportRow[]>([]);
  const [reportStatus, setReportStatus] = useState('loading');
  const [reportError, setReportError] = useState('');

  async function loadEquipment() {
    setEqStatus('loading');
    setEqError('');
    try {
      const data = await api.listEquipment(user.id);
      setEquipment(data);
      if (data.length === 0) {
        setEqStatus('empty');
      } else {
        setEqStatus('ready');
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setEqError(e.message);
      } else {
        setEqError('Could not load equipment');
      }
      setEqStatus('error');
    }
  }

  async function loadMine(page: number) {
    setMineStatus('loading');
    setMineError('');
    try {
      const result = await api.listCheckouts(user.id, page);
      setMine(result.data);
      setMinePage(result.pagination.page);
      setMineTotalPages(Math.max(1, result.pagination.total_pages));
      if (result.data.length === 0) {
        setMineStatus('empty');
      } else {
        setMineStatus('ready');
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setMineError(e.message);
      } else {
        setMineError('Could not load checkouts');
      }
      setMineStatus('error');
    }
  }

  async function loadReport() {
    setReportStatus('loading');
    setReportError('');
    try {
      const data = await api.report(user.id);
      setReport(data);
      if (data.length === 0) {
        setReportStatus('empty');
      } else {
        setReportStatus('ready');
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setReportError(e.message);
      } else {
        setReportError('Could not load report');
      }
      setReportStatus('error');
    }
  }

  useEffect(() => {
    setNotice('');
    loadEquipment();
    if (tab === 'mine') {
      loadMine(1);
    }
    if (tab === 'report') {
      loadReport();
    }
  }, [tab, user.id]);

  function checkForm() {
    let ok = true;
    setNameError('');
    setUnitsError('');
    if (name.trim() === '') {
      setNameError('Name is required');
      ok = false;
    }
    if (!/^\d+$/.test(units.trim()) || Number(units) < 1 || Number(units) > 1000) {
      setUnitsError('Units must be a whole number from 1 to 1000');
      ok = false;
    }
    return ok;
  }

  async function submitEquipment(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    setNotice('');
    if (!checkForm()) {
      return;
    }
    setSaving(true);
    try {
      const created = await api.createEquipment(user.id, name.trim(), Number(units));
      setNotice('Added ' + created.name + ' (' + created.total_units + ' units).');
      setNoticeError(false);
      setName('');
      setUnits('1');
      await loadEquipment();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Could not add equipment');
      }
    }
    setSaving(false);
  }

  async function borrow(eq: Equipment) {
    setNotice('');
    setBusyId('borrow-' + eq.id);
    try {
      await api.borrow(user.id, eq.id);
      setNotice('Borrowed one ' + eq.name + '. Due in 7 days.');
      setNoticeError(false);
      await loadEquipment();
    } catch (err) {
      if (err instanceof ApiError) {
        setNotice(err.message);
      } else {
        setNotice('Borrow failed');
      }
      setNoticeError(true);
    }
    setBusyId('');
  }

  async function returnOne(c: Checkout) {
    setNotice('');
    setBusyId('return-' + c.id);
    try {
      await api.returnCheckout(user.id, c.id);
      setNotice('Returned ' + c.equipment_name + '.');
      setNoticeError(false);
      await loadMine(minePage);
      await loadEquipment();
    } catch (err) {
      if (err instanceof ApiError) {
        setNotice(err.message);
      } else {
        setNotice('Return failed');
      }
      setNoticeError(true);
    }
    setBusyId('');
  }

  async function retire(eq: Equipment) {
    setNotice('');
    setBusyId('retire-' + eq.id);
    try {
      await api.retireEquipment(user.id, eq.id);
      setNotice('Retired ' + eq.name + '. It can no longer be borrowed.');
      setNoticeError(false);
      await loadEquipment();
    } catch (err) {
      if (err instanceof ApiError) {
        setNotice(err.message);
      } else {
        setNotice('Retire failed');
      }
      setNoticeError(true);
    }
    setBusyId('');
  }

  const isAssistant = user.role === 'assistant';
  let maxCheckedOut = 1;
  for (const r of report) {
    if (r.checked_out > maxCheckedOut) {
      maxCheckedOut = r.checked_out;
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>Lab Equipment Checkout</h1>
        <p className="sub">Borrow lab gear. Return it in 7 days. Stock never goes below zero.</p>
        <label className="user-picker">
          Acting as:{' '}
          <select
            value={user.id}
            onChange={(e) => {
              const found = SEED_USERS.find((u) => u.id === e.target.value);
              if (found) setUser(found);
            }}
          >
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

      {notice !== '' && (
        <p className={noticeError ? 'notice notice-error' : 'notice'} role="status">{notice}</p>
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
                    setNameError('');
                    setServerError('');
                  }}
                  placeholder="e.g. Oscilloscope"
                />
                {nameError !== '' && <span className="field-error">{nameError}</span>}
              </label>
              <label>
                Total units
                <input
                  value={units}
                  onChange={(e) => {
                    setUnits(e.target.value);
                    setUnitsError('');
                    setServerError('');
                  }}
                  inputMode="numeric"
                />
                {unitsError !== '' && <span className="field-error">{unitsError}</span>}
              </label>
              {serverError !== '' && <p className="field-error" role="alert">{serverError}</p>}
              <button type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add equipment'}</button>
            </form>
          )}

          <h2>Equipment</h2>
          {eqStatus === 'loading' && <p>Loading equipment...</p>}
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
                  <span>{eq.available_units} of {eq.total_units} available, {eq.checked_out} out</span>
                  <button
                    disabled={eq.available_units <= 0 || eq.retired || busyId === 'borrow-' + eq.id}
                    onClick={() => borrow(eq)}
                  >
                    {busyId === 'borrow-' + eq.id ? 'Borrowing...' : eq.retired ? 'Retired' : eq.available_units <= 0 ? 'Not available' : 'Borrow'}
                  </button>
                  {isAssistant && !eq.retired && (
                    <button className="secondary" disabled={busyId === 'retire-' + eq.id} onClick={() => retire(eq)}>
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
          <h2>My checkouts {user.role === 'assistant' ? '(all students, you are an assistant)' : ''}</h2>
          {mineStatus === 'loading' && <p>Loading your checkouts...</p>}
          {mineStatus === 'error' && (
            <p className="error-box">Could not load checkouts: {mineError} <button onClick={() => loadMine(minePage)}>Retry</button></p>
          )}
          {mineStatus === 'empty' && <p>You have no checkouts yet. Borrow something from the Equipment tab.</p>}
          {mineStatus === 'ready' && (
            <div>
              <ul className="eq-list">
                {mine.map((c) => (
                  <li key={c.id} className="card">
                    <strong>{c.equipment_name}</strong>
                    <span>{c.user_name}, borrowed {formatDate(c.borrowed_at)}</span>
                    <span>Due {formatDate(c.due_at)}</span>
                    {c.returned_at ? (
                      <span className="badge returned">Returned {formatDate(c.returned_at)}</span>
                    ) : (
                      <span>
                        {c.overdue && <span className="badge overdue">Overdue</span>}
                        <button disabled={busyId === 'return-' + c.id} onClick={() => returnOne(c)}>
                          {busyId === 'return-' + c.id ? 'Returning...' : 'Return'}
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {mineTotalPages > 1 && (
                <p>
                  <button disabled={minePage <= 1} onClick={() => loadMine(minePage - 1)}>Previous</button>{' '}
                  Page {minePage} of {mineTotalPages}{' '}
                  <button disabled={minePage >= mineTotalPages} onClick={() => loadMine(minePage + 1)}>Next</button>
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'report' && (
        <section>
          <h2>Usage report</h2>
          <p className="sub">Checked out now, and how many of those are overdue.</p>
          {reportStatus === 'loading' && <p>Loading report...</p>}
          {reportStatus === 'error' && (
            <p className="error-box">Could not load report: {reportError} <button onClick={loadReport}>Retry</button></p>
          )}
          {reportStatus === 'empty' && <p>No equipment yet, so there is nothing to report. Add equipment first.</p>}
          {reportStatus === 'ready' && (
            <div>
              <div className="chart">
                {report.map((r) => (
                  <div key={r.equipment_id} className="bar-row">
                    <span className="bar-label">{r.name}</span>
                    <div className="bar-track">
                      <div className="bar" style={{ width: (r.checked_out / maxCheckedOut) * 100 + '%' }} />
                      {r.overdue > 0 && <div className="bar overdue-bar" style={{ width: (r.overdue / maxCheckedOut) * 100 + '%' }} />}
                    </div>
                    <span>{r.checked_out} out{r.overdue > 0 ? ', ' + r.overdue + ' overdue' : ''}, {r.available_units} free</span>
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
            </div>
          )}
        </section>
      )}
    </main>
  );
}
