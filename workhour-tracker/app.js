// 数据存储
const data = {
    translators: JSON.parse(localStorage.getItem('translators')) || [],
    projects: {
        interpretation: JSON.parse(localStorage.getItem('interpretationProjects')) || [],
        translation: JSON.parse(localStorage.getItem('translationProjects')) || []
    },
    timeRecords: JSON.parse(localStorage.getItem('timeRecords')) || [],
    scheduleSettings: JSON.parse(localStorage.getItem('scheduleSettings')) || {
        dayOfWeek: 5, hour: 17, minute: 0
    }
};

function saveData() {
    localStorage.setItem('translators', JSON.stringify(data.translators));
    localStorage.setItem('interpretationProjects', JSON.stringify(data.projects.interpretation));
    localStorage.setItem('translationProjects', JSON.stringify(data.projects.translation));
    localStorage.setItem('timeRecords', JSON.stringify(data.timeRecords));
    localStorage.setItem('scheduleSettings', JSON.stringify(data.scheduleSettings));
}

// 导航切换
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderView(btn.dataset.view);
    });
});

function renderView(view) {
    const content = document.getElementById('main-content');
    switch(view) {
        case 'questionnaire': renderQuestionnaireView(content); break;
        case 'translator': renderTranslatorView(content); break;
        case 'project': renderProjectView(content); break;
        case 'analysis': renderAnalysisView(content); break;
        case 'settings': renderSettingsView(content); break;
    }
}


function renderQuestionnaireView(content) {
    const days = ['日','一','二','三','四','五','六'];
    content.innerHTML = `
        <h2 class="section-title">问卷管理</h2>
        <div class="alert info">
            <strong>自动发送设置：</strong>每周${days[data.scheduleSettings.dayOfWeek]} 
            ${String(data.scheduleSettings.hour).padStart(2,'0')}:${String(data.scheduleSettings.minute).padStart(2,'0')} 自动发送问卷
        </div>
        <button class="primary" onclick="sendQuestionnaire()">立即发送问卷</button>
        <button class="primary" onclick="fillQuestionnaire()" style="margin-left:10px;background:#2ecc71;">填写问卷（模拟译员）</button>
    `;
}

function renderTranslatorView(content) {
    const stats = calculateTranslatorStats();
    let rows = stats.map(s => `<tr><td>${s.name}</td><td>${s.interpretationTime}</td><td>${s.translationTime}</td><td>${s.totalTime}</td></tr>`).join('');
    content.innerHTML = `
        <h2 class="section-title">译员工时统计</h2>
        <div class="table-container">
            <table>
                <thead><tr><th>译员姓名</th><th>口译工时（分钟）</th><th>笔译工时（分钟）</th><th>总工时（分钟）</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999;">暂无数据</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function renderProjectView(content) {
    const stats = calculateProjectStats();
    const makeRows = (list) => list.map(s => {
        const details = s.translators.map(t => `${t.name}: ${t.time}分钟`).join('<br>');
        return `<tr><td>${s.name}</td><td>${s.totalTime}</td><td>${details || '无'}</td></tr>`;
    }).join('');
    
    content.innerHTML = `
        <h2 class="section-title">项目工时统计</h2>
        <h3 style="margin-top:20px;">口译项目</h3>
        <div class="table-container">
            <table>
                <thead><tr><th>项目名称</th><th>总工时（分钟）</th><th>参与译员及工时</th></tr></thead>
                <tbody>${makeRows(stats.interpretation) || '<tr><td colspan="3" style="text-align:center;color:#999;">暂无数据</td></tr>'}</tbody>
            </table>
        </div>
        <h3 style="margin-top:30px;">笔译项目</h3>
        <div class="table-container">
            <table>
                <thead><tr><th>项目名称</th><th>总工时（分钟）</th><th>参与译员及工时</th></tr></thead>
                <tbody>${makeRows(stats.translation) || '<tr><td colspan="3" style="text-align:center;color:#999;">暂无数据</td></tr>'}</tbody>
            </table>
        </div>
    `;
}


function renderAnalysisView(content) {
    const a = calculateAnalysis();
    content.innerHTML = `
        <h2 class="section-title">数据分析</h2>
        <div class="stats-grid">
            <div class="stat-card blue"><div class="stat-label">译员总数</div><div class="stat-value">${a.totalTranslators}</div></div>
            <div class="stat-card green"><div class="stat-label">项目总数</div><div class="stat-value">${a.totalProjects}</div></div>
            <div class="stat-card orange"><div class="stat-label">总工时（分钟）</div><div class="stat-value">${a.totalTime}</div></div>
            <div class="stat-card"><div class="stat-label">译员平均工时（分钟）</div><div class="stat-value">${a.avgTranslatorTime}</div></div>
            <div class="stat-card blue"><div class="stat-label">项目平均工时（分钟）</div><div class="stat-value">${a.avgProjectTime}</div></div>
            <div class="stat-card green"><div class="stat-label">口译总工时（分钟）</div><div class="stat-value">${a.interpretationTime}</div></div>
            <div class="stat-card orange"><div class="stat-label">笔译总工时（分钟）</div><div class="stat-value">${a.translationTime}</div></div>
        </div>
    `;
}

function renderSettingsView(content) {
    content.innerHTML = `
        <h2 class="section-title">系统设置</h2>
        <h3>译员管理</h3>
        <div id="translator-list"></div>
        <div class="add-item"><input type="text" id="new-translator" placeholder="输入译员姓名"><button onclick="addTranslator()">添加译员</button></div>
        <h3 style="margin-top:30px;">口译项目管理</h3>
        <div id="interpretation-list"></div>
        <div class="add-item"><input type="text" id="new-interpretation" placeholder="输入口译项目名称"><button onclick="addProject('interpretation')">添加项目</button></div>
        <h3 style="margin-top:30px;">笔译项目管理</h3>
        <div id="translation-list"></div>
        <div class="add-item"><input type="text" id="new-translation" placeholder="输入笔译项目名称"><button onclick="addProject('translation')">添加项目</button></div>
        <h3 style="margin-top:30px;">问卷发送时间设置</h3>
        <div class="form-group"><label>每周发送日</label>
            <select id="schedule-day"><option value="0">星期日</option><option value="1">星期一</option><option value="2">星期二</option><option value="3">星期三</option><option value="4">星期四</option><option value="5">星期五</option><option value="6">星期六</option></select>
        </div>
        <div class="form-group"><label>发送时间</label><input type="time" id="schedule-time" value="17:00"></div>
        <button class="primary" onclick="saveSchedule()">保存设置</button>
    `;
    updateSettingsLists();
    document.getElementById('schedule-day').value = data.scheduleSettings.dayOfWeek;
    document.getElementById('schedule-time').value = `${String(data.scheduleSettings.hour).padStart(2,'0')}:${String(data.scheduleSettings.minute).padStart(2,'0')}`;
}

function updateSettingsLists() {
    const makeChips = (list, type, removeFunc) => list.map((item, i) => 
        `<div class="chip">${item.name} <span class="remove" onclick="${removeFunc}(${type ? `'${type}',` : ''}${i})">×</span></div>`
    ).join('');
    
    document.getElementById('translator-list').innerHTML = makeChips(data.translators, null, 'removeTranslator');
    document.getElementById('interpretation-list').innerHTML = makeChips(data.projects.interpretation, 'interpretation', 'removeProject');
    document.getElementById('translation-list').innerHTML = makeChips(data.projects.translation, 'translation', 'removeProject');
}


function addTranslator() {
    const input = document.getElementById('new-translator');
    const name = input.value.trim();
    if (name && !data.translators.find(t => t.name === name)) {
        data.translators.push({ name, id: Date.now() });
        saveData(); input.value = ''; updateSettingsLists();
    }
}

function removeTranslator(index) {
    if (confirm('确定删除该译员吗？')) { data.translators.splice(index, 1); saveData(); updateSettingsLists(); }
}

function addProject(type) {
    const input = document.getElementById(`new-${type}`);
    const name = input.value.trim();
    if (name && !data.projects[type].find(p => p.name === name)) {
        data.projects[type].push({ name, id: Date.now(), status: 'ongoing' });
        saveData(); input.value = ''; updateSettingsLists();
    }
}

function removeProject(type, index) {
    if (confirm('确定删除该项目吗？')) { data.projects[type].splice(index, 1); saveData(); updateSettingsLists(); }
}

function saveSchedule() {
    const day = parseInt(document.getElementById('schedule-day').value);
    const time = document.getElementById('schedule-time').value.split(':');
    data.scheduleSettings = { dayOfWeek: day, hour: parseInt(time[0]), minute: parseInt(time[1]) };
    saveData(); alert('设置已保存！');
}

function sendQuestionnaire() {
    if (data.translators.length === 0) { alert('请先在设置中添加译员！'); return; }
    alert(`问卷已发送给 ${data.translators.length} 位译员！`);
}

function fillQuestionnaire() {
    if (data.translators.length === 0) { alert('请先在设置中添加译员！'); return; }
    const ongoing = data.projects.interpretation.filter(p => p.status === 'ongoing').length + 
                    data.projects.translation.filter(p => p.status === 'ongoing').length;
    if (ongoing === 0) { alert('请先在设置中添加正在进行的项目！'); return; }
    showQuestionnaireModal();
}


function showQuestionnaireModal() {
    const intProjects = data.projects.interpretation.filter(p => p.status === 'ongoing');
    const transProjects = data.projects.translation.filter(p => p.status === 'ongoing');
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
        <div style="background:white;padding:30px;border-radius:8px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">
            <h2 style="margin-bottom:20px;">工时统计问卷</h2>
            <div class="form-group"><label>选择译员</label>
                <select id="modal-translator">${data.translators.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
            </div>
            <div class="question-block">
                <div class="question-title">1. 本周口译工时</div>
                <div class="form-group"><label>选择口译项目</label>
                    <select id="interpretation-project"><option value="">-- 请选择 --</option>${intProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>投入时间（分钟）</label><input type="number" id="interpretation-time" min="0" placeholder="请输入数字"></div>
            </div>
            <div class="question-block">
                <div class="question-title">2. 本周笔译工时</div>
                <div class="form-group"><label>选择笔译项目</label>
                    <select id="translation-project"><option value="">-- 请选择 --</option>${transProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>投入时间（分钟）</label><input type="number" id="translation-time" min="0" placeholder="请输入数字"></div>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button class="primary" onclick="submitQuestionnaire()">提交</button>
                <button class="primary" onclick="closeModal()" style="background:#95a5a6;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    window.currentModal = modal;
}

function closeModal() {
    if (window.currentModal) { document.body.removeChild(window.currentModal); window.currentModal = null; }
}


function submitQuestionnaire() {
    const translatorId = parseInt(document.getElementById('modal-translator').value);
    const intProjectId = document.getElementById('interpretation-project').value;
    const intTime = parseInt(document.getElementById('interpretation-time').value) || 0;
    const transProjectId = document.getElementById('translation-project').value;
    const transTime = parseInt(document.getElementById('translation-time').value) || 0;
    
    if (!intProjectId && !transProjectId) { alert('请至少选择一个项目！'); return; }
    if (intProjectId && intTime === 0) { alert('请填写口译工时！'); return; }
    if (transProjectId && transTime === 0) { alert('请填写笔译工时！'); return; }
    
    const translator = data.translators.find(t => t.id === translatorId);
    
    if (intProjectId && intTime > 0) {
        const project = data.projects.interpretation.find(p => p.id === parseInt(intProjectId));
        data.timeRecords.push({ id: Date.now(), translatorId, translatorName: translator.name, projectId: parseInt(intProjectId), projectName: project.name, type: 'interpretation', time: intTime, date: new Date().toISOString() });
    }
    if (transProjectId && transTime > 0) {
        const project = data.projects.translation.find(p => p.id === parseInt(transProjectId));
        data.timeRecords.push({ id: Date.now() + 1, translatorId, translatorName: translator.name, projectId: parseInt(transProjectId), projectName: project.name, type: 'translation', time: transTime, date: new Date().toISOString() });
    }
    
    saveData(); closeModal(); alert('问卷提交成功！'); renderView('translator');
}

function calculateTranslatorStats() {
    return data.translators.map(t => {
        const records = data.timeRecords.filter(r => r.translatorId === t.id);
        const intTime = records.filter(r => r.type === 'interpretation').reduce((s, r) => s + r.time, 0);
        const transTime = records.filter(r => r.type === 'translation').reduce((s, r) => s + r.time, 0);
        return { name: t.name, interpretationTime: intTime, translationTime: transTime, totalTime: intTime + transTime };
    });
}


function calculateProjectStats() {
    const calcStats = (projects, type) => projects.map(project => {
        const records = data.timeRecords.filter(r => r.projectId === project.id && r.type === type);
        const totalTime = records.reduce((s, r) => s + r.time, 0);
        const translators = [];
        records.forEach(r => {
            const existing = translators.find(t => t.name === r.translatorName);
            if (existing) existing.time += r.time;
            else translators.push({ name: r.translatorName, time: r.time });
        });
        return { name: project.name, totalTime, translators };
    });
    return {
        interpretation: calcStats(data.projects.interpretation, 'interpretation'),
        translation: calcStats(data.projects.translation, 'translation')
    };
}

function calculateAnalysis() {
    const totalTime = data.timeRecords.reduce((s, r) => s + r.time, 0);
    const intTime = data.timeRecords.filter(r => r.type === 'interpretation').reduce((s, r) => s + r.time, 0);
    const transTime = data.timeRecords.filter(r => r.type === 'translation').reduce((s, r) => s + r.time, 0);
    const totalProjects = data.projects.interpretation.length + data.projects.translation.length;
    
    return {
        totalTranslators: data.translators.length,
        totalProjects,
        totalTime,
        interpretationTime: intTime,
        translationTime: transTime,
        avgTranslatorTime: data.translators.length > 0 ? Math.round(totalTime / data.translators.length) : 0,
        avgProjectTime: totalProjects > 0 ? Math.round(totalTime / totalProjects) : 0
    };
}

// 初始化
renderView('questionnaire');
