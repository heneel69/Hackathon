export async function renderMoveHistory(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2><span class="material-icons-outlined">history</span> Move History (The Ledger)</h2>
      <button class="btn btn-outline" onclick="window.location.hash=''">Back</button>
    </div>

    <div class="card p-lg filter-card mb-md">
      <div class="filter-grid"" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: end;">
        <div>
          <label>Operation Type</label>
          <select id="filter-type" class="input">
            <option value="">All Operations</option>
            <option value="Receipt">Receipt</option>
            <option value="Delivery">Delivery</option>
            <option value="Internal Transfer">Internal Transfer</option>
            <option value="Adjustment">Adjustment</option>
          </select>
        </div>
        <div>
          <label>Start Date</label>
          <input type="date" id="filter-start" class="input" />
        </div>
        <div>
          <label>End Date</label>
          <input type="date" id="filter-end" class="input" />
        </div>
        <div>
          <button id="btn-filter" class="btn btn-primary w-full">Apply Filters</button>
        </div>
      </div>
    </div>

    <div class="card p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Operation</th>
            <th>Product</th>
            <th>Qty Change</th>
            <th>Source</th>
            <th>Destination</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody id="history-tbody">
          <tr><td colspan="7" style="text-align:center;">Loading history...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Attach event listeners
  document.getElementById('btn-filter').addEventListener('click', () => loadHistory());

  await loadHistory();
}

async function loadHistory() {
  const tbody = document.getElementById('history-tbody');
  
  const type = document.getElementById('filter-type').value;
  const start = document.getElementById('filter-start').value;
  const end = document.getElementById('filter-end').value;

  const params = new URLSearchParams();
  if (type) params.append('operation_type', type);
  if (start) params.append('start_date', start);
  if (end) params.append('end_date', end);

  try {
    const res = await fetch(`/api/ledger?${params.toString()}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No history records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(entry => {
      const isPositive = entry.quantity_change > 0;
      const colorClass = isPositive ? 'text-success' : 'text-danger';
      const sign = isPositive ? '+' : '';
      
      const qtyCell = `<strong class="${colorClass}">${sign}${entry.quantity_change}</strong>`;
      const dateStr = new Date(entry.created_at).toLocaleString();

      return `
        <tr>
          <td>${dateStr}</td>
          <td><span class="badge ${getBadgeClass(entry.operation_type)}">${entry.operation_type}</span></td>
          <td>
            <strong>${entry.product_name}</strong><br/>
            <small class="text-muted">${entry.sku}</small>
          </td>
          <td>${qtyCell} ${entry.unit_of_measure}</td>
          <td>${entry.source_warehouse_name || '-'}</td>
          <td>${entry.dest_warehouse_name || '-'}</td>
          <td>${entry.user_name || '-'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger" style="text-align:center;">Error: ${err.message}</td></tr>`;
  }
}

function getBadgeClass(type) {
  switch (type) {
    case 'Receipt': return 'badge-success';
    case 'Delivery': return 'badge-warning';
    case 'Internal Transfer': return 'badge-info';
    case 'Adjustment': return 'badge-danger';
    default: return 'badge-secondary';
  }
}
