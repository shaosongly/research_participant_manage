import { ProjectOperations, CenterOperations, SubjectOperations, VisitRecordOperations } from '../common/db-operations.js';

// 添加在文件开头
let deleteType = ''; // 'project' 或 'center'
let deleteProject = '';
let deleteCenter = '';

// 添加显示删除确认框的函数
function showDeleteConfirm(type, project, center = '') {
    deleteType = type;
    deleteProject = project;
    deleteCenter = center;
    
    const message = deleteType === 'project' 
        ? `确定要删除项目"${project}"吗？这将同时删除该项目下的所有中心和受试者数据。`
        : `确定要删除"${project}"项目下的"${center}"中心吗？这将同时删除该中心下的所有受试者数据。`;
    
    document.getElementById('deleteConfirmMessage').textContent = message;
    new bootstrap.Modal(document.getElementById('confirmDeleteModal')).show();
}

// 添加删除按钮事件监听
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-project-btn')) {
        const project = e.target.getAttribute('data-project');
        showDeleteConfirm('project', project);
    } else if (e.target.classList.contains('delete-center-btn')) {
        const project = e.target.getAttribute('data-project');
        const center = e.target.getAttribute('data-center');
        showDeleteConfirm('center', project, center);
    }
});

// 加载项目列表
async function loadProjects() {
    try {
        // 获取所有数据
        const projects = await ProjectOperations.getAllProjects();
        const centers = await CenterOperations.getAllCenters();
        const subjects = await SubjectOperations.getAllSubjects();

        // 计算每个中心的受试者数量
        const centerSubjectCounts = new Map();
        subjects.forEach(subject => {
            const key = `${subject.project}-${subject.center}`;
            centerSubjectCounts.set(key, (centerSubjectCounts.get(key) || 0) + 1);
        });

        // 组织数据结构
        const projectMap = new Map();
        projects.forEach(project => {
            projectMap.set(project.projectName, new Set());
        });

        centers.forEach(center => {
            if (projectMap.has(center.projectName)) {
                projectMap.get(center.projectName).add(center.centerName);
            }
        });

        // 渲染项目列表
        renderProjectList(projectMap, centerSubjectCounts);
    } catch (error) {
        console.error('Error loading projects:', error);
        alert('加载项目列表失败');
    }
}

// 保存新项目
document.getElementById('saveProjectBtn').addEventListener('click', async function () {
    const projectName = document.getElementById('projectName').value.trim();
    const centerName = document.getElementById('centerName').value.trim();

    if (!projectName || !centerName) {
        alert('请填写完整信息');
        return;
    }

    try {
        await ProjectOperations.addProject(projectName, centerName);
        await loadProjects();
        closeModal('newProjectModal');
        document.getElementById('newProjectForm').reset();
    } catch (error) {
        console.error('Error saving project:', error);
        alert('保存失败，请重试');
    }
});

// 保存新中心
document.getElementById('saveCenterBtn').addEventListener('click', async function () {
    const projectName = document.getElementById('projectForCenter').value;
    const centerName = document.getElementById('newCenterName').value.trim();

    if (!projectName || !centerName) {
        alert('请填写完整信息');
        return;
    }

    try {
        await CenterOperations.addCenter(projectName, centerName);
        await loadProjects();
        closeModal('newCenterModal');
        document.getElementById('newCenterForm').reset();
    } catch (error) {
        console.error('Error saving center:', error);
        alert('保存失败，请重试');
    }
});

// 删除项目或中心
document.getElementById('confirmDeleteBtn').addEventListener('click', async function () {
    try {
        if (deleteType === 'project') {
            await ProjectOperations.deleteProject(deleteProject);
        } else if (deleteType === 'center') {
            await CenterOperations.deleteCenter(deleteProject, deleteCenter);
        }

        closeModal('confirmDeleteModal');
        await loadProjects();
    } catch (error) {
        console.error('Delete error:', error);
        alert('删除失败，请重试');
    }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadProjects();

    // 添加中心按钮点击事件处理
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('add-center-btn')) {
            const projectName = e.target.getAttribute('data-project');
            document.getElementById('projectForCenter').value = projectName;
        }
    });

    // 删除按钮事件监听
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-project-btn')) {
            const project = e.target.getAttribute('data-project');
            showDeleteConfirm('project', project);
        } else if (e.target.classList.contains('delete-center-btn')) {
            const project = e.target.getAttribute('data-project');
            const center = e.target.getAttribute('data-center');
            showDeleteConfirm('center', project, center);
        }
    });
});

function renderProjectList(projectMap, centerSubjectCounts) {
    const projectList = document.getElementById('projectList');
    projectList.innerHTML = '';

    for (const [projectName, centers] of projectMap) {
        const projectCard = document.createElement('div');
        projectCard.className = 'card project-card';
        projectCard.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">${projectName}</h5>
                <div class="btn-group">
                    <button class="btn btn-primary btn-sm add-center-btn" 
                            data-bs-toggle="modal" 
                            data-bs-target="#newCenterModal" 
                            data-project="${projectName}">
                        添加中心
                    </button>
                    <button class="btn btn-danger btn-sm delete-project-btn" 
                            data-project="${projectName}">
                        删除项目
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="center-list">
                    ${Array.from(centers).map(centerName => `
                        <div class="center-item">
                            <span>${centerName} 
                                (${centerSubjectCounts.get(`${projectName}-${centerName}`) || 0} 名受试者)
                            </span>
                            <button class="btn btn-danger btn-sm delete-center-btn"
                                    data-project="${projectName}" 
                                    data-center="${centerName}">
                                删除
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        projectList.appendChild(projectCard);
    }
}

// 添加一个通用的关闭模态框函数
function closeModal(modalId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
    if (modal) {
        modal.hide();
    }
    
    // 移除模态框背景
    const modalBackdrop = document.querySelector('.modal-backdrop');
    if (modalBackdrop) {
        modalBackdrop.remove();
    }
    
    // 清理 body 样式
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}
