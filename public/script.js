const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const welcomeMessage = document.getElementById('welcomeMessage');

let conversationHistory = [];
let chartCounter = 0;
let tableCounter = 0;
let messageCounter = 0;
const PAGE_SIZE = 10;

// Brand color palette for charts
const CHART_COLORS = ['#00ADEF', '#003C71', '#0090C9', '#42B0D5', '#0077A3', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#C2E3EF'];

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    sendButton.disabled = !this.value.trim();
});

// Check server status on load
async function checkServerStatus() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.status === 'ok') {
            statusDot.className = 'w-1.5 h-1.5 rounded-full bg-green-400';
            statusText.textContent = 'Connected';
            sendButton.disabled = false;
        }
    } catch (error) {
        statusDot.className = 'w-1.5 h-1.5 rounded-full bg-red-400';
        statusText.textContent = 'Connection Failed';
        console.error('Server connection failed:', error);
    }
}

// Format time
function formatTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Hide welcome message
function hideWelcomeMessage() {
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }
}

// Add message to UI
function addMessage(content, isUser = false) {
    // Hide welcome message when first message is sent
    hideWelcomeMessage();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-4';

    if (isUser) {
        // User message - using APM navy gradient
        messageDiv.innerHTML = `
            <div class="flex justify-end">
                <div class="max-w-[85%] sm:max-w-3xl">
                    <div class="bg-apm-500 text-white rounded-2xl rounded-tr-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
                        <p class="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(content)}</p>
                        <div class="flex items-center gap-1.5 mt-1.5 sm:mt-2 text-xs text-white/70">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span>${formatTime()}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Assistant message
        const msgId = 'msg-' + (messageCounter++);
        messageDiv.innerHTML = `
            <div class="max-w-[95%] sm:max-w-4xl">
                <div class="bg-gray-50 border border-gray-200 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
                    <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-200/60 text-xs">
                        <div class="flex items-center gap-2.5">
                            <span class="inline-flex items-center gap-1 bg-apmt-orange-50 text-apmt-orange-500 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md">apmt</span>
                            <span class="text-gray-400 text-xs hidden sm:inline">${formatTime()}</span>
                        </div>
                        <div class="flex items-center">
                            <button onclick="expandMessage('${msgId}')" title="Expand" class="btn-icon btn-flat-orange">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6m0 0v6m0-6L13 11M9 21H3m0 0v-6m0 6l8-8"/></svg>
                            </button>
                            <button onclick="exportMessage('${msgId}')" title="Export" class="btn-icon btn-flat-orange">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            </button>
                        </div>
                    </div>
                    <div id="${msgId}" class="prose prose-sm max-w-none text-gray-700 text-xs sm:text-sm msg-content leading-relaxed">
                        ${formatMessage(content)}
                    </div>
                    <div class="flex items-center gap-1 mt-3 pt-2 border-t border-gray-200/60">
                        <button onclick="expandMessage('${msgId}')" title="Expand" class="btn-flat btn-flat-orange" style="font-size:10px;">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6m0 0v6m0-6L13 11M9 21H3m0 0v-6m0 6l8-8"/></svg>
                            Expand
                        </button>
                        <button onclick="exportMessage('${msgId}')" title="Export" class="btn-flat btn-flat-orange" style="font-size:10px;">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            Export
                        </button>
                        <button onclick="openEmailModal('${msgId}')" title="Email" class="btn-flat btn-flat-orange" style="font-size:10px;">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                            Email
                        </button>
                        <button onclick="toggleAnnotations('${msgId}')" title="Add note" class="btn-flat btn-flat-orange" style="font-size:10px;">
                            <i data-lucide="message-square-plus" class="w-3 h-3"></i>
                            Note
                        </button>
                        <span class="flex-grow"></span>
                        <button onclick="submitFeedback('${msgId}', 1, this)" title="Helpful" class="btn-flat btn-flat-orange feedback-btn" style="font-size:10px;">
                            <i data-lucide="thumbs-up" class="w-3 h-3"></i>
                        </button>
                        <button onclick="submitFeedback('${msgId}', -1, this)" title="Not helpful" class="btn-flat btn-flat-orange feedback-btn" style="font-size:10px;">
                            <i data-lucide="thumbs-down" class="w-3 h-3"></i>
                        </button>
                    </div>
                    <div id="annotations-${msgId}" class="annotation-panel hidden"></div>
                </div>
            </div>
        `;
        // Store raw content for export
        messageDiv.querySelector(`#${msgId}`).setAttribute('data-raw', content);
    }

    messagesContainer.appendChild(messageDiv);

    // Render any charts in the message
    if (!isUser) {
        renderCharts(messageDiv);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Render Lucide icons in the new message
    if (typeof lucide !== 'undefined') lucide.createIcons();

    return messageDiv;
}

// Build ApexCharts options from simple spec
function buildApexConfig(spec) {
    const isHorizontal = spec.type === 'horizontalBar';
    const isPieType = spec.type === 'pie' || spec.type === 'donut' || spec.type === 'doughnut';
    const isLine = spec.type === 'line';
    const chartType = isHorizontal ? 'bar' : (spec.type === 'doughnut' ? 'donut' : spec.type);

    if (isPieType) {
        return {
            chart: {
                type: chartType,
                height: 320,
                fontFamily: 'Maersk Headline, sans-serif',
                toolbar: { show: false },
                dropShadow: { enabled: true, top: 2, left: 0, blur: 4, opacity: 0.08 },
            },
            series: spec.datasets[0].data,
            labels: spec.labels,
            colors: spec.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
            title: {
                text: spec.title,
                style: { fontSize: '14px', fontWeight: 400, color: '#003C71', fontFamily: 'Maersk Headline, sans-serif' },
            },
            legend: {
                position: 'bottom',
                fontSize: '12px',
                fontFamily: 'Maersk Headline, sans-serif',
                markers: { radius: 3 },
            },
            dataLabels: {
                enabled: true,
                formatter: (val) => Math.round(val) + '%',
                style: { fontSize: '11px', fontWeight: 500 },
                dropShadow: { enabled: false },
            },
            stroke: { width: 2, colors: ['#fff'] },
            tooltip: {
                y: { formatter: (val) => val },
                style: { fontSize: '12px', fontFamily: 'Maersk Headline, sans-serif' },
            },
            plotOptions: {
                pie: {
                    donut: { size: chartType === 'donut' ? '55%' : '0%' },
                    expandOnClick: true,
                },
            },
        };
    }

    // Bar / Line charts
    const series = spec.datasets.map((ds, i) => ({
        name: ds.label,
        data: ds.data,
    }));

    return {
        chart: {
            type: isHorizontal ? 'bar' : (isLine ? 'line' : 'bar'),
            height: 320,
            fontFamily: 'Maersk Headline, sans-serif',
            toolbar: { show: false },
            zoom: { enabled: false },
            dropShadow: isLine ? { enabled: true, top: 3, left: 0, blur: 4, opacity: 0.12 } : { enabled: false },
        },
        series: series,
        colors: spec.datasets.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        title: {
            text: spec.title,
            style: { fontSize: '14px', fontWeight: 400, color: '#003C71', fontFamily: 'Maersk Headline, sans-serif' },
        },
        xaxis: {
            categories: spec.labels,
            labels: {
                style: { fontSize: '11px', colors: '#6b7280', fontFamily: 'Maersk Headline, sans-serif' },
                rotate: spec.labels.length > 6 ? -45 : 0,
                trim: true,
                maxHeight: 80,
            },
            axisBorder: { color: '#e5e7eb' },
            axisTicks: { color: '#e5e7eb' },
        },
        yaxis: {
            labels: {
                style: { fontSize: '11px', colors: '#6b7280', fontFamily: 'Maersk Headline, sans-serif' },
                formatter: (val) => typeof val === 'number' ? (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : Math.round(val * 100) / 100) : val,
            },
        },
        plotOptions: {
            bar: {
                horizontal: isHorizontal,
                borderRadius: 4,
                columnWidth: spec.datasets.length > 1 ? '60%' : '45%',
                dataLabels: { position: 'top' },
            },
        },
        dataLabels: {
            enabled: !isLine && spec.labels.length <= 10,
            offsetY: -20,
            style: { fontSize: '10px', colors: ['#6b7280'], fontWeight: 500 },
            formatter: (val) => typeof val === 'number' ? (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val) : val,
        },
        stroke: {
            width: isLine ? 3 : 0,
            curve: 'smooth',
        },
        markers: isLine ? { size: 4, strokeWidth: 2, hover: { size: 6 } } : {},
        grid: {
            borderColor: '#f3f4f6',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
        },
        legend: {
            show: spec.datasets.length > 1,
            position: 'top',
            fontSize: '12px',
            fontFamily: 'Maersk Headline, sans-serif',
            markers: { radius: 3 },
        },
        tooltip: {
            shared: true,
            intersect: false,
            style: { fontSize: '12px', fontFamily: 'Maersk Headline, sans-serif' },
            y: { formatter: (val) => typeof val === 'number' ? val.toLocaleString() : val },
        },
        fill: {
            type: isLine ? 'gradient' : 'solid',
            gradient: isLine ? { shadeIntensity: 0.3, opacityFrom: 0.5, opacityTo: 0.1 } : {},
        },
    };
}

// Render charts after message is in DOM (with pagination for >10 data points)
function renderCharts(container) {
    const chartDivs = container.querySelectorAll('.chart-container[data-chart-spec]');
    chartDivs.forEach(div => {
        try {
            const spec = JSON.parse(div.getAttribute('data-chart-spec'));
            const isPieType = spec.type === 'pie' || spec.type === 'donut' || spec.type === 'doughnut';
            const needsPagination = !isPieType && spec.labels.length > PAGE_SIZE;
            const containerId = 'chart-wrap-' + (chartCounter++);
            div.id = containerId;

            if (needsPagination) {
                // Store full spec for pagination
                div.setAttribute('data-chart-full-spec', JSON.stringify(spec));
                const totalPages = Math.ceil(spec.labels.length / PAGE_SIZE);

                // Render first page
                const pagedSpec = {
                    ...spec,
                    labels: spec.labels.slice(0, PAGE_SIZE),
                    datasets: spec.datasets.map(ds => ({
                        ...ds,
                        data: ds.data.slice(0, PAGE_SIZE),
                    })),
                };

                const chartEl = document.createElement('div');
                chartEl.className = 'apex-chart-wrapper';
                div.appendChild(chartEl);
                const chart = new ApexCharts(chartEl, buildApexConfig(pagedSpec));
                chart.render();

                // Add pagination controls
                const controls = document.createElement('div');
                controls.className = 'flex items-center justify-between mt-1 px-1';
                controls.innerHTML = `
                    <span class="text-xs text-gray-500">Showing <span data-chart-range>1-${Math.min(PAGE_SIZE, spec.labels.length)}</span> of ${spec.labels.length} items</span>
                    <div class="flex items-center gap-1">
                        <button onclick="paginateChart('${containerId}', -1, this)" data-chart-prev disabled class="btn-icon" style="width:24px;height:24px;"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                        <span class="text-xs text-gray-600 px-1"><span data-chart-page-num>1</span>/${totalPages}</span>
                        <button onclick="paginateChart('${containerId}', 1, this)" data-chart-next ${totalPages <= 1 ? 'disabled' : ''} class="btn-icon" style="width:24px;height:24px;"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                    </div>
                `;
                div.appendChild(controls);
            } else {
                // No pagination needed — render directly
                const chartEl = document.createElement('div');
                chartEl.className = 'apex-chart-wrapper';
                div.appendChild(chartEl);
                const chart = new ApexCharts(chartEl, buildApexConfig(spec));
                chart.render();
            }
        } catch (e) {
            console.error('Chart render error:', e);
            div.innerHTML = '<p class="text-xs text-red-500 p-2">Chart could not be rendered</p>';
        }
    });
}

// Format message with markdown-like rendering and chart support
function formatMessage(text) {
    // Step 1: Extract chart blocks before escaping
    const charts = [];
    text = text.replace(/```chart\s*\n([\s\S]*?)```/g, (match, json) => {
        try {
            const spec = JSON.parse(json.trim());
            const idx = charts.length;
            charts.push(spec);
            return `%%CHART_${idx}%%`;
        } catch (e) {
            return match; // leave malformed blocks as-is
        }
    });

    // Step 2: Escape HTML
    text = escapeHtml(text);

    // Step 3: Convert markdown tables (with pagination for >10 rows)
    text = text.replace(/((?:^\|.+\|$\n?)+)/gm, (tableBlock) => {
        const rows = tableBlock.trim().split('\n').filter(r => r.trim());
        if (rows.length < 2) return tableBlock;

        // Filter out separator rows (|---|---|---| or | :--: | --- | etc)
        const dataRows = rows.filter(row => !/^\|[\s\-:|\u2013\u2014]+$/.test(row.trim()));
        const headerRow = dataRows[0];
        const bodyRows = dataRows.slice(1);
        const totalDataRows = bodyRows.length;
        const needsPagination = totalDataRows > PAGE_SIZE;
        const tid = 'tbl-' + (tableCounter++);

        // Build header
        const headerCells = headerRow.split('|').filter(c => c !== '');
        let headerHtml = '<tr>' + headerCells.map(c =>
            `<th class="bg-apm-500 text-white font-semibold px-3 py-2 border border-gray-200 text-left whitespace-nowrap">${c.trim()}</th>`
        ).join('') + '</tr>';

        // Build body rows with data-page attribute
        let bodyHtml = '';
        bodyRows.forEach((row, i) => {
            const cells = row.split('|').filter(c => c !== '');
            const page = Math.floor(i / PAGE_SIZE);
            const stripe = i % 2 === 0 ? 'bg-gray-50' : 'bg-white';
            const hidden = needsPagination && page > 0 ? ' style="display:none"' : '';
            bodyHtml += `<tr data-table-id="${tid}" data-page="${page}" class="${stripe}"${hidden}>`;
            cells.forEach(cell => {
                bodyHtml += `<td class="px-3 py-2 border border-gray-200 text-left whitespace-nowrap">${cell.trim()}</td>`;
            });
            bodyHtml += '</tr>';
        });

        let html = `<div class="overflow-x-auto my-3"><table class="min-w-full text-xs border-collapse">${headerHtml}${bodyHtml}</table>`;

        // Pagination controls
        if (needsPagination) {
            const totalPages = Math.ceil(totalDataRows / PAGE_SIZE);
            html += `<div class="flex items-center justify-between mt-2 px-1" data-pagination="${tid}">
                <span class="text-xs text-gray-500">Showing <span data-range="${tid}">1-${Math.min(PAGE_SIZE, totalDataRows)}</span> of ${totalDataRows} rows</span>
                <div class="flex items-center gap-1">
                    <button onclick="paginateTable('${tid}', -1, this)" data-prev="${tid}" disabled class="btn-icon" style="width:24px;height:24px;"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                    <span class="text-xs text-gray-600 px-1"><span data-page-num="${tid}">1</span>/${totalPages}</span>
                    <button onclick="paginateTable('${tid}', 1, this)" data-next="${tid}" ${totalPages <= 1 ? 'disabled' : ''} class="btn-icon" style="width:24px;height:24px;"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                </div>
            </div>`;
        }

        html += '</div>';
        return html;
    });

    // Step 4: Convert newlines to <br>
    text = text.replace(/\n/g, '<br>');

    // Step 5: Bold text **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');

    // Step 6: Inline code `text`
    text = text.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 text-apm-600 rounded text-xs font-mono">$1</code>');

    // Step 7: Headings (### text)
    text = text.replace(/#{3}\s+(.+?)(<br>|$)/g, '<h3 class="text-sm font-medium text-apm-600 mt-3 mb-1">$1</h3>');
    text = text.replace(/#{2}\s+(.+?)(<br>|$)/g, '<h2 class="text-base font-medium text-apm-600 mt-4 mb-2">$1</h2>');

    // Step 8: Bullet points
    text = text.replace(/(?:^|<br>)[•\-\*]\s+(.+?)(?=<br>|$)/g, '<li class="ml-4 my-0.5">$1</li>');
    text = text.replace(/(<li.*?<\/li>)+/g, '<ul class="list-disc space-y-0.5 my-2 pl-2">$&</ul>');

    // Step 9: Numbered lists
    text = text.replace(/(?:^|<br>)\d+\.\s+(.+?)(?=<br>|$)/g, '<li class="ml-4 my-0.5">$1</li>');

    // Step 10: Highlight important metrics
    text = text.replace(/\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(CMPH|containers?|moves?|hours?|TEU|vessels?|days?|minutes?|mins?)\b/gi,
        '<span class="inline-flex items-center px-2 py-0.5 bg-maersk-50 text-maersk-700 rounded font-medium text-xs">$1 $2</span>');

    // Step 11: Highlight status keywords
    text = text.replace(/\b(INBOUND|ARRIVED|WORKING|DEPARTED|COMPLETE|CLOSED|ACTIVE|SCHEDULED)\b/g,
        '<span class="inline-flex items-center px-2 py-0.5 bg-apm-50 text-apm-700 rounded font-medium text-xs uppercase tracking-wide">$1</span>');

    // Step 12: Drill-down — make entity names clickable
    // Visit IDs (V000086, etc)
    text = text.replace(/\b(V\d{6})\b/g,
        '<span class="drilldown" onclick="drillDown(\'Show me full details and crane performance for vessel visit $1\')" title="Click to drill down">$1</span>');
    // Vessel names (2+ uppercase words like MAERSK EDINBURGH, MSC ANNA)
    text = text.replace(/\b((?:MAERSK|MSC|CMA|COSCO|HAPAG|ONE|EVERGREEN|YANG|ZIM|PIL)\s+[A-Z][A-Z\s]{2,20}?)(?=[\s,<|])/g,
        '<span class="drilldown" onclick="drillDown(\'Show me productivity, cranes, and delays for $1\')" title="Click to drill down">$1</span>');
    // Crane names (Quay Crane 01, QC01, etc)
    text = text.replace(/\b(Quay Crane \d{1,2}|QC\d{1,2})\b/g,
        '<span class="drilldown" onclick="drillDown(\'Show me all moves and delays for $1\')" title="Click to drill down">$1</span>');

    // Step 13: Replace chart placeholders with actual HTML
    charts.forEach((spec, idx) => {
        const specJson = JSON.stringify(spec).replace(/"/g, '&quot;');
        text = text.replace(
            `%%CHART_${idx}%%`,
            `<div class="chart-container" data-chart-spec="${specJson}"></div>`
        );
    });

    // Clean up orphan <br> tags
    text = text.replace(/<br>\s*<br>\s*<br>/g, '<br><br>');
    text = text.replace(/<br><\/?(ul|ol|li|h2|h3|div|table)/g, '</$1'.replace('/', '') === '$1' ? '<$1' : '<br><$1');

    return text;
}

// Expand message to fullscreen modal
window.expandMessage = function(msgId) {
    const msgEl = document.getElementById(msgId);
    if (!msgEl) return;

    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'expand-modal';
    modal.className = 'fixed inset-0 z-50 flex items-start justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeExpandModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl m-4 mt-8 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-modal-in">
            <div class="bg-white px-6 py-4 border-b border-gray-100">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-apmt-orange-500 text-[10px] tracking-widest uppercase">apmt</div>
                        <div class="text-apm-500 text-sm">Report</div>
                        <div class="text-gray-400 text-[11px]">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="exportMessage('${msgId}')" class="btn-flat btn-flat-primary">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            Export
                        </button>
                        <button onclick="toggleModalFullscreen()" id="fullscreenBtn" class="btn-icon" title="Fullscreen">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>
                        </button>
                        <button onclick="closeExpandModal()" class="btn-icon">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-6 sm:p-8 text-sm text-gray-800 expanded-content">
                ${msgEl.innerHTML}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Re-render charts inside the modal (with pagination support)
    const modalContent = modal.querySelector('.expanded-content');
    const chartDivs = modalContent.querySelectorAll('.chart-container[data-chart-spec]');
    chartDivs.forEach(div => {
        div.innerHTML = '';
        div.style.maxWidth = '700px';
    });
    renderCharts(modalContent);

    // Close on Escape
    const handleEsc = (e) => {
        if (e.key === 'Escape') { closeExpandModal(); document.removeEventListener('keydown', handleEsc); }
    };
    document.addEventListener('keydown', handleEsc);
};

window.closeExpandModal = function() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const modal = document.getElementById('expand-modal');
    if (modal) modal.remove();
};

window.toggleModalFullscreen = function() {
    const modal = document.getElementById('expand-modal');
    if (!modal) return;
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        modal.requestFullscreen().catch(() => {});
    }
};

// Export message as printable page
window.exportMessage = async function(msgId) {
    const msgEl = document.getElementById(msgId);
    if (!msgEl) return;

    // Capture charts as images
    const chartContainers = msgEl.querySelectorAll('.chart-container');
    const chartImages = new Map();
    for (const container of chartContainers) {
        try {
            const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
            chartImages.set(container, canvas.toDataURL('image/png'));
        } catch (e) { console.error('Chart capture failed:', e); }
    }

    // Build offscreen render container
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;padding:40px;font-family:Maersk Headline,sans-serif;color:#1a1a1a;';

    // Header
    wrapper.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FF6B35;padding-bottom:16px;margin-bottom:24px;">
            <div style="font-size:18px;color:#003C71;">APMT Operations Report</div>
            <div style="font-size:12px;color:#666;text-align:right;">
                <div>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        </div>
    `;

    // Clone and prepare content
    const content = msgEl.cloneNode(true);
    content.style.cssText = 'font-size:13px;line-height:1.7;';

    // Replace charts with images
    content.querySelectorAll('.chart-container').forEach(container => {
        const orig = Array.from(chartContainers).find(c =>
            c.getAttribute('data-chart-spec') === container.getAttribute('data-chart-spec')
        );
        const imgSrc = orig ? chartImages.get(orig) : null;
        if (imgSrc) {
            container.innerHTML = `<img src="${imgSrc}" style="width:100%;max-width:520px;margin:12px 0;border-radius:4px;">`;
            container.style.cssText = 'background:none;border:none;padding:0;box-shadow:none;';
        } else { container.remove(); }
    });

    // Show all paginated rows, remove controls
    content.querySelectorAll('tr[style]').forEach(r => r.style.display = '');
    content.querySelectorAll('[data-pagination]').forEach(el => el.remove());
    content.querySelectorAll('[data-chart-prev],[data-chart-next]').forEach(el => el.parentElement?.remove());

    // Style tables in the clone
    content.querySelectorAll('table').forEach(t => t.style.cssText = 'width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;');
    content.querySelectorAll('th').forEach(th => th.style.cssText = 'background:#003C71;color:#fff;padding:8px 12px;text-align:left;');
    content.querySelectorAll('td').forEach(td => td.style.cssText = 'padding:6px 12px;border:1px solid #e0e0e0;');

    wrapper.appendChild(content);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:32px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;text-align:center;';
    footer.textContent = 'Generated by APMT Operations Intelligence Platform';
    wrapper.appendChild(footer);

    document.body.appendChild(wrapper);

    // Wait for images to load
    const imgs = wrapper.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
    ));

    // Capture to canvas
    const pdfCanvas = await html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
    document.body.removeChild(wrapper);

    // Generate PDF with jsPDF
    const { jsPDF } = window.jspdf;
    const imgData = pdfCanvas.toDataURL('image/png');
    const pdfWidth = 210; // A4 mm
    const pdfHeight = (pdfCanvas.height * pdfWidth) / pdfCanvas.width;
    const pageHeight = 297; // A4 mm

    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;

    // Multi-page support
    while (position < pdfHeight) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight, undefined, 'FAST');
        position += pageHeight;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    pdf.save(`APMT-Report-${timestamp}.pdf`);
};

// Table pagination (scoped to the button's container)
window.paginateTable = function(tid, direction, btn) {
    // Scope to the nearest container (works in both main view and modal)
    const container = btn ? btn.closest('[data-pagination]')?.parentElement : document;
    const root = container || document;

    const pageNumEl = root.querySelector(`[data-page-num="${tid}"]`);
    const rangeEl = root.querySelector(`[data-range="${tid}"]`);
    const prevBtn = root.querySelector(`[data-prev="${tid}"]`);
    const nextBtn = root.querySelector(`[data-next="${tid}"]`);
    const allRows = root.querySelectorAll(`tr[data-table-id="${tid}"]`);

    if (!pageNumEl || !allRows.length) return;

    const totalRows = allRows.length;
    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    let currentPage = parseInt(pageNumEl.textContent) - 1;
    currentPage += direction;

    if (currentPage < 0 || currentPage >= totalPages) return;

    allRows.forEach(row => row.style.display = 'none');
    allRows.forEach(row => {
        if (parseInt(row.getAttribute('data-page')) === currentPage) {
            row.style.display = '';
        }
    });

    const start = currentPage * PAGE_SIZE + 1;
    const end = Math.min((currentPage + 1) * PAGE_SIZE, totalRows);
    pageNumEl.textContent = currentPage + 1;
    rangeEl.textContent = `${start}-${end}`;
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
};

// Chart pagination
window.paginateChart = function(chartContainerId, direction, btn) {
    // Scope: find the container closest to the clicked button, or fall back to getElementById
    const container = btn ? btn.closest('.chart-container') : document.getElementById(chartContainerId);
    if (!container) return;

    const spec = JSON.parse(container.getAttribute('data-chart-full-spec'));
    const pageNumEl = container.querySelector('[data-chart-page-num]');
    const totalLabels = spec.labels.length;
    const totalPages = Math.ceil(totalLabels / PAGE_SIZE);
    let currentPage = parseInt(pageNumEl.textContent) - 1;
    currentPage += direction;

    if (currentPage < 0 || currentPage >= totalPages) return;

    // Slice data for this page
    const start = currentPage * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, totalLabels);
    const pagedSpec = {
        ...spec,
        labels: spec.labels.slice(start, end),
        datasets: spec.datasets.map(ds => ({
            ...ds,
            data: ds.data.slice(start, end),
        })),
    };

    // Re-render chart
    const chartEl = container.querySelector('.apex-chart-wrapper');
    chartEl.innerHTML = '';
    const newChart = new ApexCharts(chartEl, buildApexConfig(pagedSpec));
    newChart.render();

    // Update controls
    pageNumEl.textContent = currentPage + 1;
    const rangeEl = container.querySelector('[data-chart-range]');
    rangeEl.textContent = `${start + 1}-${end}`;
    container.querySelector('[data-chart-prev]').disabled = currentPage === 0;
    container.querySelector('[data-chart-next]').disabled = currentPage >= totalPages - 1;
};

// Render follow-up suggestion chips
function renderFollowups(followups) {
    // Remove any existing followups
    const existing = document.getElementById('followup-chips');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'followup-chips';
    wrapper.className = 'max-w-[95%] sm:max-w-4xl mt-2 mb-4';

    const inner = document.createElement('div');
    inner.className = 'flex flex-wrap gap-2';

    followups.forEach(q => {
        const chip = document.createElement('button');
        chip.className = 'query-btn';
        chip.textContent = q;
        chip.onclick = () => {
            wrapper.remove();
            messageInput.value = q;
            sendButton.disabled = false;
            chatForm.dispatchEvent(new Event('submit'));
        };
        inner.appendChild(chip);
    });

    wrapper.appendChild(inner);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show loading indicator
const LOADING_MESSAGES = {
    vessel: [
        'Querying vessel visit records',
        'Checking berth allocations',
        'Analyzing arrival and departure times',
        'Calculating port stay durations',
        'Preparing vessel summary',
    ],
    productivity: [
        'Fetching move event data',
        'Calculating container moves per hour',
        'Benchmarking against targets',
        'Ranking vessel performance',
        'Preparing productivity analysis',
    ],
    crane: [
        'Querying crane assignments',
        'Analyzing crane move sequences',
        'Checking twin lift ratios',
        'Evaluating crane utilization',
        'Preparing crane report',
    ],
    delay: [
        'Scanning delay records',
        'Categorizing delay causes',
        'Calculating downtime impact',
        'Identifying root causes',
        'Preparing delay analysis',
    ],
    yard: [
        'Scanning yard inventory',
        'Counting TEUs by block',
        'Checking reefer and hazmat units',
        'Analyzing dwell times',
        'Preparing yard snapshot',
    ],
    gate: [
        'Querying gate transactions',
        'Calculating truck turnaround times',
        'Analyzing receive and delivery volumes',
        'Identifying peak hour patterns',
        'Preparing gate summary',
    ],
    compare: [
        'Fetching this week data',
        'Fetching last week data',
        'Calculating period differences',
        'Identifying significant changes',
        'Preparing comparison report',
    ],
    overview: [
        'Querying all terminal systems',
        'Pulling vessel and crane data',
        'Scanning yard and gate records',
        'Aggregating KPIs',
        'Building terminal dashboard',
    ],
    default: [
        'Connecting to terminal database',
        'Analyzing your question',
        'Querying relevant data',
        'Processing results',
        'Preparing response',
    ],
};

function detectLoadingCategory(message) {
    const m = message.toLowerCase();
    if (m.includes('overview') || m.includes('dashboard') || m.includes('everything')) return 'overview';
    if (m.includes('compare') || m.includes('vs') || m.includes('versus') || m.includes('week')) return 'compare';
    if (m.includes('delay') || m.includes('downtime') || m.includes('breakdown')) return 'delay';
    if (m.includes('crane') || m.includes('qc') || m.includes('twin')) return 'crane';
    if (m.includes('productivity') || m.includes('cmph') || m.includes('best') || m.includes('worst') || m.includes('perform')) return 'productivity';
    if (m.includes('yard') || m.includes('inventory') || m.includes('dwell') || m.includes('teu') || m.includes('block')) return 'yard';
    if (m.includes('gate') || m.includes('truck') || m.includes('turnaround')) return 'gate';
    if (m.includes('vessel') || m.includes('visit') || m.includes('berth') || m.includes('ship')) return 'vessel';
    return 'default';
}

let loadingInterval = null;
let currentLoadingCategory = 'default';

function showLoading(userMessage) {
    hideWelcomeMessage();
    currentLoadingCategory = detectLoadingCategory(userMessage || '');

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'mb-4';
    loadingDiv.id = 'loading-message';

    loadingDiv.innerHTML = `
        <div class="max-w-[95%] sm:max-w-4xl">
            <div class="bg-gray-50 border border-gray-200 rounded-2xl px-4 sm:px-5 py-4 sm:py-5 shadow-sm">
                <div class="flex items-start gap-3">
                    <div class="thinking-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <div>
                        <span class="text-sm text-gray-600 loading-text" style="transition:opacity 0.3s">${LOADING_MESSAGES[currentLoadingCategory][0]}</span>
                        <div class="text-[10px] text-gray-300 mt-1 loading-sub">This may take a few seconds</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Rotate category-specific messages every 2.5 seconds
    const msgs = LOADING_MESSAGES[currentLoadingCategory];
    let msgIndex = 1;
    loadingInterval = setInterval(() => {
        const label = loadingDiv.querySelector('.loading-text');
        if (!label) return;
        label.style.opacity = '0';
        setTimeout(() => {
            label.textContent = msgs[msgIndex % msgs.length];
            label.style.opacity = '1';
            msgIndex++;
        }, 300);
    }, 2500);

    return loadingDiv;
}

// Remove loading indicator
function removeLoading() {
    if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
    const loading = document.getElementById('loading-message');
    if (loading) {
        loading.remove();
    }
}

// Build the assistant message shell (reused by both streaming and non-streaming)
function createAssistantShell(msgId) {
    const div = document.createElement('div');
    div.className = 'mb-4';
    div.innerHTML = `<div class="max-w-[95%] sm:max-w-4xl"><div class="bg-gray-50 border border-gray-200 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm"><div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-200/60 text-xs"><div class="flex items-center gap-2.5"><span class="inline-flex items-center gap-1 bg-apmt-orange-50 text-apmt-orange-500 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md">apmt</span><span class="text-gray-400 text-xs">${formatTime()}</span></div><div class="flex items-center"><button onclick="expandMessage('${msgId}')" title="Expand" class="btn-icon btn-flat-orange"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6m0 0v6m0-6L13 11M9 21H3m0 0v-6m0 6l8-8"/></svg></button><button onclick="exportMessage('${msgId}')" title="Export" class="btn-icon btn-flat-orange"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button></div></div><div id="${msgId}" class="prose prose-sm max-w-none text-gray-700 text-xs sm:text-sm msg-content leading-relaxed"></div><div class="flex items-center gap-1 mt-3 pt-2 border-t border-gray-200/60"><button onclick="expandMessage('${msgId}')" class="btn-flat btn-flat-orange" style="font-size:10px;"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6m0 0v6m0-6L13 11M9 21H3m0 0v-6m0 6l8-8"/></svg> Expand</button><button onclick="exportMessage('${msgId}')" class="btn-flat btn-flat-orange" style="font-size:10px;"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Export</button><button onclick="openEmailModal('${msgId}')" class="btn-flat btn-flat-orange" style="font-size:10px;"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg> Email</button><span class="flex-grow"></span><button onclick="submitFeedback('${msgId}', 1, this)" title="Helpful" class="btn-flat btn-flat-orange feedback-btn" style="font-size:10px;"><i data-lucide="thumbs-up" class="w-3 h-3"></i></button><button onclick="submitFeedback('${msgId}', -1, this)" title="Not helpful" class="btn-flat btn-flat-orange feedback-btn" style="font-size:10px;"><i data-lucide="thumbs-down" class="w-3 h-3"></i></button></div></div></div>`;
    return div;
}

// Send message to API
async function sendMessage(message) {
    conversationHistory.push({ role: 'user', content: message });
    addMessage(message, true);

    await ensureConversation();

    const oldChips = document.getElementById('followup-chips');
    if (oldChips) oldChips.remove();

    showLoading(message);
    messageInput.disabled = true;
    sendButton.disabled = true;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory, conversationId: currentConversationId })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        removeLoading();

        conversationHistory.push({ role: 'assistant', content: data.message });
        addMessage(data.message, false);
        playChime();

        if (data.followups && data.followups.length > 0) {
            renderFollowups(data.followups);
            addDynamicSuggestions(data.followups);
        }

    } catch (error) {
        removeLoading();
        console.error('Error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mb-4';
        errorDiv.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-3"><p class="text-xs text-red-700">${error.message || 'Connection error. Please try again.'}</p></div>`;
        messagesContainer.appendChild(errorDiv);
    } finally {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;

    // Send message
    await sendMessage(message);
});

// Handle suggestion buttons
function sendSuggestion(message) {
    messageInput.value = message;
    sendButton.disabled = false;
    chatForm.dispatchEvent(new Event('submit'));
}

// Handle Enter key (Shift+Enter for newline)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (messageInput.value.trim()) {
            chatForm.dispatchEvent(new Event('submit'));
        }
    }
});

// ─── Clear Chat ─────────────────────────────────────────────────────────────

let currentConversationId = null;

async function ensureConversation() {
    if (!currentConversationId) {
        try {
            const res = await fetch('/api/conversations', { method: 'POST' });
            const data = await res.json();
            currentConversationId = data.id;
        } catch (e) { console.error('Failed to create conversation:', e); }
    }
    return currentConversationId;
}

function clearChat() {
    conversationHistory = [];
    currentConversationId = null;
    messagesContainer.innerHTML = '';
    // Re-add welcome with conversation starters
    const welcome = document.createElement('div');
    welcome.id = 'welcomeMessage';
    welcome.className = 'flex flex-col items-center justify-center h-full max-w-2xl mx-auto';
    welcome.innerHTML = `
        <div class="text-center px-4 mb-8">
            <p class="text-[10px] text-apmt-orange-500 tracking-widest uppercase mb-3">apmt ai assistant</p>
            <h2 class="text-xl sm:text-2xl font-normal text-apm-500 mb-2">How can I help you today?</h2>
            <p class="text-xs sm:text-sm text-gray-400">Ask me anything about terminal operations in plain English</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full px-4 sm:px-0">
            <button onclick="sendSuggestion('Give me a full overview of the terminal today — vessels, moves, yard, gate, everything')" class="starter-btn"><i data-lucide="layout-dashboard" class="w-4 h-4 text-apmt-orange-500"></i><span>Give me a full overview of the terminal today</span></button>
            <button onclick="sendSuggestion('How are we performing this week compared to last week?')" class="starter-btn"><i data-lucide="git-compare" class="w-4 h-4 text-apmt-orange-500"></i><span>How are we performing this week vs last week?</span></button>
            <button onclick="sendSuggestion('Which vessels are at the terminal right now and what is their productivity?')" class="starter-btn"><i data-lucide="ship" class="w-4 h-4 text-apmt-orange-500"></i><span>Which vessels are here and how productive are they?</span></button>
            <button onclick="sendSuggestion('What are the main causes of crane delays this month?')" class="starter-btn"><i data-lucide="alert-triangle" class="w-4 h-4 text-apmt-orange-500"></i><span>What are the main causes of crane delays?</span></button>
            <button onclick="sendSuggestion('Are there any containers with unusually long dwell times in the yard?')" class="starter-btn"><i data-lucide="clock" class="w-4 h-4 text-apmt-orange-500"></i><span>Are containers staying too long in the yard?</span></button>
            <button onclick="sendSuggestion('Show me our best and worst performing vessels this month by CMPH')" class="starter-btn"><i data-lucide="trophy" class="w-4 h-4 text-apmt-orange-500"></i><span>Who are our best and worst performers?</span></button>
        </div>
        <p class="text-[10px] text-gray-300 mt-6">Or just type your own question below</p>
    `;
    messagesContainer.appendChild(welcome);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    const chips = document.getElementById('followup-chips');
    if (chips) chips.remove();
    messageInput.focus();
}

// ─── Conversation History ───────────────────────────────────────────────────

function toggleHistory() {
    const sidebar = document.getElementById('historySidebar');
    const isHidden = sidebar.classList.contains('hidden');
    if (isHidden) {
        sidebar.classList.remove('hidden');
        loadHistoryList();
    } else {
        sidebar.classList.add('hidden');
    }
}

async function loadHistoryList() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="text-xs text-gray-400 p-3">Loading...</div>';
    try {
        const res = await fetch('/api/conversations');
        const convos = await res.json();
        if (convos.length === 0) {
            list.innerHTML = '<div class="text-xs text-gray-400 p-3">No conversations yet</div>';
            return;
        }
        list.innerHTML = convos.map(c => `
            <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors ${c.id === currentConversationId ? 'bg-apmt-orange-50' : ''}" onclick="loadConversation('${c.id}')">
                <div class="flex-1 min-w-0">
                    <div class="text-xs text-gray-700 truncate">${escapeHtml(c.title)}</div>
                    <div class="text-[10px] text-gray-400">${c.message_count} msgs &middot; ${new Date(c.updated_at).toLocaleDateString()}</div>
                </div>
                <button onclick="event.stopPropagation();deleteConversation('${c.id}')" class="btn-icon opacity-0 group-hover:opacity-100" style="width:24px;height:24px;" title="Delete">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (e) {
        list.innerHTML = '<div class="text-xs text-red-400 p-3">Failed to load</div>';
    }
}

async function loadConversation(id) {
    try {
        const res = await fetch(`/api/conversations/${id}`);
        const messages = await res.json();
        // Reset UI
        conversationHistory = [];
        messagesContainer.innerHTML = '';
        const welcome = document.getElementById('welcomeMessage');
        if (welcome) welcome.style.display = 'none';
        currentConversationId = id;
        // Replay messages
        messages.forEach(m => {
            conversationHistory.push({ role: m.role, content: m.content });
            addMessage(m.content, m.role === 'user');
        });
        toggleHistory();
    } catch (e) { console.error('Failed to load conversation:', e); }
}

async function deleteConversation(id) {
    try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        if (id === currentConversationId) clearChat();
        loadHistoryList();
    } catch (e) { console.error('Failed to delete:', e); }
}

// ─── KPI Cards ──────────────────────────────────────────────────────────────

async function loadKPIs() {
    try {
        const res = await fetch('/api/kpis');
        const data = await res.json();
        document.getElementById('kpi-vessels').textContent = data.activeVessels.toLocaleString();
        document.getElementById('kpi-moves').textContent = data.totalMovesToday.toLocaleString();
        document.getElementById('kpi-yard').textContent = data.yardTeus.toLocaleString();
        document.getElementById('kpi-turnaround').textContent = data.avgTurnaround ? data.avgTurnaround + ' min' : 'N/A';
    } catch (e) { console.error('KPI load error:', e); }
}

// ─── Compare Mode ───────────────────────────────────────────────────────────

function sendCompare(metric) {
    const prompts = {
        moves: 'Compare this week\'s total vessel moves vs last week\'s. Show both periods side by side in a table and a grouped bar chart.',
        delays: 'Compare this week\'s crane delay totals by category vs last week\'s. Show a side-by-side comparison table and chart.',
        productivity: 'Compare this week\'s average vessel productivity (CMPH) vs last week\'s. Show comparison chart.',
        turnaround: 'Compare today\'s average truck turnaround vs yesterday. Show comparison chart.',
    };
    messageInput.value = prompts[metric] || prompts.moves;
    sendButton.disabled = false;
    chatForm.dispatchEvent(new Event('submit'));
}

// ─── Patch sendMessage to include conversationId ────────────────────────────

const originalFetch = window.fetch;
// (conversationId is sent via the existing sendMessage body — need to patch it)

// ─── Initialize ─────────────────────────────────────────────────────────────

// ─── Email Modal ────────────────────────────────────────────────────────────

let emailTargetMsgId = null;

window.openEmailModal = function(msgId) {
    emailTargetMsgId = msgId;
    const modal = document.createElement('div');
    modal.id = 'emailModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/30" onclick="closeEmailModal()"></div>
        <div class="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-5 animate-modal-in">
            <div class="text-sm text-apm-500 mb-3">Send Report by Email</div>
            <input type="email" id="emailInput" placeholder="recipient@example.com"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-apmt-orange-500 mb-3">
            <div id="emailStatus" class="text-xs mb-3 hidden"></div>
            <div class="flex items-center gap-2 justify-end">
                <button onclick="closeEmailModal()" class="btn-flat">Cancel</button>
                <button onclick="sendReportEmail()" id="emailSendBtn" class="btn-flat btn-flat-primary">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('emailInput')?.focus(), 100);
};

window.closeEmailModal = function() {
    const modal = document.getElementById('emailModal');
    if (modal) modal.remove();
};

window.sendReportEmail = async function() {
    const emailInput = document.getElementById('emailInput');
    const statusEl = document.getElementById('emailStatus');
    const sendBtn = document.getElementById('emailSendBtn');
    const email = emailInput?.value?.trim();

    if (!email) { emailInput.focus(); return; }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    statusEl.className = 'text-xs mb-3 hidden';

    try {
        const msgEl = document.getElementById(emailTargetMsgId);
        const html = msgEl ? msgEl.innerHTML : '';

        const res = await fetch('/api/send-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, html, subject: 'APMT Operations Report' })
        });

        const data = await res.json();
        if (res.ok) {
            statusEl.textContent = 'Sent successfully!';
            statusEl.className = 'text-xs mb-3 text-green-600';
            statusEl.classList.remove('hidden');
            setTimeout(closeEmailModal, 1500);
        } else {
            throw new Error(data.error || 'Failed to send');
        }
    } catch (e) {
        statusEl.textContent = e.message;
        statusEl.className = 'text-xs mb-3 text-red-500';
        statusEl.classList.remove('hidden');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
};

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────────

window.toggleShortcutModal = function() {
    const modal = document.getElementById('shortcutModal');
    modal.classList.toggle('hidden');
};

window.closeShortcutModal = function() {
    const modal = document.getElementById('shortcutModal');
    if (modal) modal.classList.add('hidden');
};

document.addEventListener('keydown', (e) => {
    const isMod = e.ctrlKey || e.metaKey;

    if (isMod && e.key === 'k') {
        e.preventDefault();
        messageInput.focus();
    }
    if (isMod && e.key === 'e') {
        e.preventDefault();
        const lastMsg = document.querySelectorAll('.msg-content');
        const last = lastMsg[lastMsg.length - 1];
        if (last) exportMessage(last.id);
    }
    if (isMod && e.key === 'n') {
        e.preventDefault();
        clearChat();
    }
    if (e.key === 'Escape') {
        closeExpandModal();
        closeEmailModal();
        closeShortcutModal();
        const sidebar = document.getElementById('historySidebar');
        if (sidebar && !sidebar.classList.contains('hidden')) toggleHistory();
    }
    if (e.key === '?' && document.activeElement !== messageInput) {
        toggleShortcutModal();
    }
});

// ─── Onboarding Tour ────────────────────────────────────────────────────────

function startOnboardingTour() {
    if (localStorage.getItem('apmt-tour-done')) return;
    if (typeof window.driver === 'undefined') return;

    const driverObj = window.driver.js.driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(0,60,113,0.5)',
        steps: [
            {
                element: '#kpiCards',
                popover: {
                    title: 'Live KPIs',
                    description: 'Real-time terminal metrics — active vessels, moves, yard TEUs, truck turnaround. Refreshes every 5 minutes.',
                    side: 'bottom',
                }
            },
            {
                element: '#quickQueries',
                popover: {
                    title: 'Quick Queries',
                    description: 'One-click access to common reports. Start with Terminal Overview for a complete daily dashboard.',
                    side: 'bottom',
                }
            },
            {
                element: '#chatForm',
                popover: {
                    title: 'Ask Anything',
                    description: 'Type natural language questions — "show me last week\'s delays", "compare this week vs last week", "why is productivity low today?"',
                    side: 'top',
                }
            },
            {
                element: '#welcomeMessage',
                popover: {
                    title: 'Rich Reports',
                    description: 'Every response includes charts and tables. Use Expand for fullscreen, Export to download PDF, or Email to send the report.',
                    side: 'top',
                }
            },
        ],
        onDestroyed: () => localStorage.setItem('apmt-tour-done', '1'),
    });

    setTimeout(() => driverObj.drive(), 800);
}

window.restartTour = function() {
    localStorage.removeItem('apmt-tour-done');
    startOnboardingTour();
};

// ─── Typeahead Suggestions ───────────────────────────────────────────────────

const SUGGESTIONS = [
    // Natural conversational questions
    { text: 'Give me a full overview of the terminal today', category: 'Overview' },
    { text: 'How are we performing this week compared to last week?', category: 'Compare' },
    { text: 'What vessels are at the terminal right now?', category: 'Vessels' },
    { text: 'Which vessels are currently working?', category: 'Vessels' },
    { text: 'What is the productivity of each vessel today?', category: 'Vessels' },
    { text: 'Show me the CMPH for all vessels this month', category: 'Vessels' },
    { text: 'Who are our best and worst performing vessels?', category: 'Vessels' },
    { text: 'How many cranes are working on each vessel?', category: 'Cranes' },
    { text: 'What are the main causes of crane delays?', category: 'Delays' },
    { text: 'Which cranes have the most downtime?', category: 'Delays' },
    { text: 'What percentage of delays are caused by equipment failures?', category: 'Delays' },
    { text: 'Are containers staying too long in the yard?', category: 'Yard' },
    { text: 'Show me the current yard inventory breakdown', category: 'Yard' },
    { text: 'What is our yard utilization by block?', category: 'Yard' },
    { text: 'How many reefer containers are in the yard?', category: 'Yard' },
    { text: 'How is the gate performing today?', category: 'Gate' },
    { text: 'What is the average truck turnaround time?', category: 'Gate' },
    { text: 'What are the peak hours at the gate?', category: 'Gate' },
    { text: 'How many vessels can we handle per day?', category: 'Capacity' },
    { text: 'What is our berth utilization this month?', category: 'Capacity' },
    { text: 'Compare this week moves vs last week', category: 'Compare' },
    { text: 'Compare delays this week vs last week', category: 'Compare' },
    { text: 'What happened with productivity yesterday?', category: 'Analysis' },
    { text: 'Why is the CMPH low for the current vessel?', category: 'Analysis' },
    { text: 'Show me all equipment and their status', category: 'Equipment' },
];

let typeaheadIndex = -1;
let dynamicSuggestions = []; // AI-generated from follow-ups

function addDynamicSuggestions(followups) {
    // Remove old dynamic suggestions
    dynamicSuggestions = followups.map(text => ({ text, category: 'Suggested' }));
}

function showTypeahead(query) {
    const dropdown = document.getElementById('typeahead');
    if (!query || query.length < 2) {
        dropdown.classList.add('hidden');
        typeaheadIndex = -1;
        return;
    }

    const words = query.toLowerCase().split(/\s+/);

    // Dynamic suggestions (from last AI response) ranked first
    const dynamicMatches = dynamicSuggestions.filter(s =>
        words.every(w => s.text.toLowerCase().includes(w))
    );
    const staticMatches = SUGGESTIONS.filter(s =>
        words.every(w => s.text.toLowerCase().includes(w))
    );
    const matches = [...dynamicMatches, ...staticMatches].slice(0, 8);

    if (matches.length === 0) {
        dropdown.classList.add('hidden');
        typeaheadIndex = -1;
        return;
    }

    let lastCategory = '';
    dropdown.innerHTML = matches.map((s, i) => {
        let html = s.text;
        for (const w of words) {
            if (w.length < 2) continue;
            const regex = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            html = html.replace(regex, '<span class="match">$1</span>');
        }
        let prefix = '';
        if (s.category !== lastCategory) {
            lastCategory = s.category;
            prefix = `<div class="typeahead-category">${s.category}</div>`;
        }
        return prefix + `<div class="typeahead-item${i === typeaheadIndex ? ' active' : ''}" data-index="${i}" onmousedown="selectTypeahead(${i})">${html}</div>`;
    }).join('');

    dropdown.classList.remove('hidden');
}

window.selectTypeahead = function(index) {
    const dropdown = document.getElementById('typeahead');
    const words = messageInput.value.toLowerCase().split(/\s+/);
    const dynamicMatches = dynamicSuggestions.filter(s => words.every(w => s.text.toLowerCase().includes(w)));
    const staticMatches = SUGGESTIONS.filter(s => words.every(w => s.text.toLowerCase().includes(w)));
    const matches = [...dynamicMatches, ...staticMatches].slice(0, 8);
    if (matches[index]) {
        messageInput.value = matches[index].text;
        sendButton.disabled = false;
    }
    dropdown.classList.add('hidden');
    typeaheadIndex = -1;
    chatForm.dispatchEvent(new Event('submit'));
};

// Hook into the existing input event
messageInput.addEventListener('input', function() {
    showTypeahead(this.value.trim());
});

// Arrow key navigation
messageInput.addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('typeahead');
    if (dropdown.classList.contains('hidden')) return;

    const items = dropdown.querySelectorAll('.typeahead-item');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        typeaheadIndex = Math.min(typeaheadIndex + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('active', i === typeaheadIndex));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        typeaheadIndex = Math.max(typeaheadIndex - 1, 0);
        items.forEach((el, i) => el.classList.toggle('active', i === typeaheadIndex));
    } else if (e.key === 'Tab' || (e.key === 'Enter' && typeaheadIndex >= 0)) {
        if (typeaheadIndex >= 0) {
            e.preventDefault();
            selectTypeahead(typeaheadIndex);
        }
    } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
        typeaheadIndex = -1;
    }
});

// Hide on blur
messageInput.addEventListener('blur', function() {
    setTimeout(() => {
        document.getElementById('typeahead')?.classList.add('hidden');
        typeaheadIndex = -1;
    }, 150);
});

// ─── Annotations ────────────────────────────────────────────────────────────

window.toggleAnnotations = async function(msgId) {
    const panel = document.getElementById('annotations-' + msgId);
    if (!panel) return;

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        await loadAnnotations(msgId);
    } else {
        panel.classList.add('hidden');
    }
};

async function loadAnnotations(msgId) {
    const panel = document.getElementById('annotations-' + msgId);
    if (!panel) return;

    let notes = [];
    try {
        const res = await fetch('/api/annotations/' + msgId);
        notes = await res.json();
    } catch (e) {}

    panel.innerHTML = notes.map(n => `
        <div class="annotation-item">
            <span class="annotation-author">${escapeHtml(n.author)}</span>
            <span class="annotation-text">${escapeHtml(typeof n.text === 'string' ? n.text : String(n.text))}</span>
            <span class="annotation-time">${n.created_at ? new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</span>
            <button onclick="deleteAnnotation(${n.id}, '${msgId}')" class="btn-icon" style="width:18px;height:18px;flex-shrink:0;"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
    `).join('') + `
        <div class="annotation-input">
            <input type="text" id="note-input-${msgId}" placeholder="Add a note..." onkeydown="if(event.key==='Enter')submitAnnotation('${msgId}')">
            <button onclick="submitAnnotation('${msgId}')" class="btn-flat btn-flat-primary" style="padding:4px 10px;font-size:10px;">Add</button>
        </div>
    `;
}

window.submitAnnotation = async function(msgId) {
    const input = document.getElementById('note-input-' + msgId);
    if (!input || !input.value.trim()) return;

    try {
        await fetch('/api/annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: msgId, author: 'User', text: input.value.trim() })
        });
        await loadAnnotations(msgId);
    } catch (e) { console.error('Annotation error:', e); }
};

window.deleteAnnotation = async function(id, msgId) {
    try {
        await fetch('/api/annotations/' + id, { method: 'DELETE' });
        await loadAnnotations(msgId);
    } catch (e) {}
};

// ─── Drill-Down ─────────────────────────────────────────────────────────────

window.drillDown = function(query) {
    messageInput.value = query;
    sendButton.disabled = false;
    chatForm.dispatchEvent(new Event('submit'));
};

// ─── Voice Input ────────────────────────────────────────────────────────────

let recognition = null;
let isRecording = false;

// Terminal vocabulary corrections for speech recognition
const TERM_CORRECTIONS = {
    // Vessel-related
    'faces': 'vessels', 'vessel\'s': 'vessels', 'wessels': 'vessels', 'vassals': 'vessels',
    'facials': 'vessels', 'vases': 'vessels', 'fossils': 'vessels', 'feces': 'vessels',
    'accident': 'active vessels', 'accidents': 'active vessels',
    'active faces': 'active vessels', 'active vases': 'active vessels',
    'active fossil': 'active vessels', 'active fossils': 'active vessels',
    'axle vessels': 'active vessels', 'acted vessels': 'active vessels',
    // Crane-related
    'crane\'s': 'cranes', 'trains': 'cranes', 'canes': 'cranes', 'grains': 'cranes',
    'queen': 'crane', 'queens': 'cranes',
    // Terminal terms
    'birth': 'berth', 'births': 'berths', 'burst': 'berth',
    'dwell': 'dwell', 'jewel': 'dwell', 'dual': 'dwell',
    'yard': 'yard', 'guard': 'yard',
    'key pies': 'KPIs', 'kp eyes': 'KPIs', 'kp ice': 'KPIs', 'kpis': 'KPIs',
    'sea mph': 'CMPH', 'cmph': 'CMPH', 'c mph': 'CMPH',
    'tu\'s': 'TEUs', 'choose': 'TEUs', 'tools': 'TEUs', 'use': 'TEUs',
    'delays': 'delays', 'the lays': 'delays', 'relays': 'delays',
    'gate': 'gate', 'get': 'gate', 'gait': 'gate',
    'moves': 'moves', 'moose': 'moves', 'news': 'moves',
    'productivity': 'productivity', 'productive tea': 'productivity',
    'turn around': 'turnaround', 'turn-around': 'turnaround',
    'discharge': 'discharge', 'this charge': 'discharge',
    'load': 'load', 'lode': 'load',
    'inventory': 'inventory', 'in a tree': 'inventory',
    'utilization': 'utilization', 'utilisation': 'utilization',
    // Carriers
    'mersk': 'maersk', 'mars': 'maersk', 'mask': 'maersk',
    'msc': 'MSC', 'MSE': 'MSC',
    'cosco': 'COSCO', 'costco': 'COSCO',
    // Time
    'today\'s': 'today\'s', 'todays': 'today\'s',
    'this week\'s': 'this week\'s', 'last week\'s': 'last week\'s',
    'terminal': 'terminal', 'terminals': 'terminal',
    'overview': 'overview', 'over you': 'overview',
    'equipment': 'equipment', 'equip mint': 'equipment',
};

// Full phrase corrections (checked first — catches mangled multi-word combos)
const PHRASE_CORRECTIONS = [
    [/show\s*(me\s*)?(the\s*)?accident/gi, 'show me the active vessels'],
    [/active\s*(faces|vases|fossils|feces|basis)/gi, 'active vessels'],
    [/terminal\s*(over\s*view|over\s*you|overview)/gi, 'terminal overview'],
    [/crane\s*(the lays|relays|de lays)/gi, 'crane delays'],
    [/vessel\s*(productive tea|productivity)/gi, 'vessel productivity'],
    [/dwell\s*(time|thyme|tie)/gi, 'dwell time'],
    [/gate\s*(active tea|activity|activities)/gi, 'gate activity'],
    [/yard\s*(in\s*a\s*tree|inventory)/gi, 'yard inventory'],
    [/truck\s*(turn\s*around|turnaround)/gi, 'truck turnaround'],
    [/planned\s*(verse|vs|versus|first)\s*(executed|exec)/gi, 'planned vs executed'],
    [/this\s*week\s*(verse|vs|versus|first)\s*last\s*week/gi, 'this week vs last week'],
    [/compare\s*(this|the)\s*week/gi, 'compare this week'],
    [/best\s*(and|in)\s*worst\s*(vessels|faces|fossils)/gi, 'best and worst vessels'],
    [/berth\s*(utilization|utilisation|utilise)/gi, 'berth utilization'],
    [/delay\s*(breakdown|break\s*down|brick\s*down)/gi, 'delay breakdown'],
    [/sea\s*mph|see\s*mph|c\.?\s*m\.?\s*p\.?\s*h/gi, 'CMPH'],
];

function fixTerminalTerms(text) {
    let fixed = text;

    // Phase 1: full phrase corrections
    for (const [pattern, replacement] of PHRASE_CORRECTIONS) {
        fixed = fixed.replace(pattern, replacement);
    }

    // Phase 2: single word corrections (sort by length so longer matches first)
    const entries = Object.entries(TERM_CORRECTIONS).sort((a, b) => b[0].length - a[0].length);
    for (const [wrong, right] of entries) {
        const regex = new RegExp('\\b' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
        fixed = fixed.replace(regex, right);
    }

    return fixed;
}

window.toggleVoice = function() {
    if (isRecording) {
        stopVoice();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Voice input is not supported in this browser. Use Chrome or Edge.');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    const micBtn = document.getElementById('micButton');
    micBtn.classList.add('mic-recording');
    isRecording = true;
    messageInput.placeholder = 'Listening...';

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        messageInput.value = fixTerminalTerms(transcript);
        sendButton.disabled = !transcript.trim();
    };

    recognition.onend = () => {
        stopVoice();
        // Auto-send if we have text
        if (messageInput.value.trim()) {
            chatForm.dispatchEvent(new Event('submit'));
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        stopVoice();
    };

    recognition.start();
};

function stopVoice() {
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }
    isRecording = false;
    const micBtn = document.getElementById('micButton');
    micBtn.classList.remove('mic-recording');
    messageInput.placeholder = 'Ask about vessel visits, productivity metrics, schedules...';
}

// ─── Sound Notification ─────────────────────────────────────────────────────

function playChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
}

// ─── Response Feedback ──────────────────────────────────────────────────────

window.submitFeedback = async function(msgId, rating, btn) {
    const row = btn.closest('.flex');
    const buttons = row.querySelectorAll('.feedback-btn');

    buttons.forEach(b => { b.style.opacity = '0.3'; b.disabled = true; });
    btn.style.opacity = '1';
    btn.style.color = rating === 1 ? '#10b981' : '#ef4444';

    try {
        await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: currentConversationId, messageId: msgId, rating })
        });
    } catch(e) { console.error('Feedback error:', e); }
};

// ─── Initialize ─────────────────────────────────────────────────────────────

checkServerStatus();
loadKPIs();

// Query scroll fade indicators
(function initQueryScroll() {
    const scroll = document.getElementById('queryScroll');
    if (!scroll) return;
    const fadeL = scroll.parentElement.querySelector('.query-fade-left');
    const fadeR = scroll.parentElement.querySelector('.query-fade-right');

    function update() {
        const { scrollLeft, scrollWidth, clientWidth } = scroll;
        fadeL.classList.toggle('visible', scrollLeft > 8);
        fadeR.classList.toggle('visible', scrollLeft < scrollWidth - clientWidth - 8);
    }

    scroll.addEventListener('scroll', update, { passive: true });
    update();
    setTimeout(update, 500);

    window.scrollQueries = function(dir) {
        scroll.scrollBy({ left: dir * 250, behavior: 'smooth' });
    };
})();
setInterval(loadKPIs, 5 * 60 * 1000);
startOnboardingTour();
