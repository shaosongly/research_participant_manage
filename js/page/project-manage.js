import { ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';

// 导航栏组件
const NavBar = {
    template: `
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="landing.html">受试者管理系统</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                    aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto"> <!-- 添加 ms-auto 类 -->
                    <li class="nav-item">
                        <a class="nav-link" href="landing.html">首页</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" href="project_manage.html">项目管理</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="index.html">添加受试者</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="view.html">查看受试者</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="schedule.html">访视安排</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="visit_plan.html">访视计划</a>
                    </li>
                    <li class="nav-item"></li>
                        <a class="nav-link" href="visit_record.html">访视记录</a>
                    </li>
                    <li class="nav-item"></li>
                        <a class="nav-link" href="window_check.html">超窗检查</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    `
};

// 项目列表组件
const ProjectList = {
    props: ['projects', 'centerSubjectCounts'],
    template: `
        <div id="projectList">
            <div v-for="[projectName, centers] in projects" :key="projectName" class="card project-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">{{ projectName }}</h5>
                    <div class="btn-group">
                        <button class="btn btn-primary btn-sm" 
                                @click="$emit('add-center', projectName)">
                            添加中心
                        </button>
                        <button class="btn btn-danger btn-sm"
                                @click="$emit('delete-project', projectName)">
                            删除项目
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="center-list">
                        <div v-for="centerName in centers" :key="centerName" class="center-item">
                            <span>{{ centerName }} ({{ getCenterSubjectCount(projectName, centerName) }} 名受试者)</span>
                            <button class="btn btn-danger btn-sm"
                                    @click="$emit('delete-center', { project: projectName, center: centerName })">
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    methods: {
        getCenterSubjectCount(project, center) {
            return this.centerSubjectCounts.get(`${project}-${center}`) || 0;
        }
    }
};

// 项目模态框组件
const ProjectModal = {
    template: `
        <div class="modal show" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">新建项目</h5>
                        <button type="button" class="btn-close" @click="$emit('close')"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">项目名称</label>
                            <input type="text" class="form-control" v-model="projectName" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">初始中心名称</label>
                            <input type="text" class="form-control" v-model="centerName" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="$emit('close')">取消</button>
                        <button type="button" class="btn btn-primary" @click="handleSave">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            projectName: '',
            centerName: ''
        };
    },
    emits: ['save', 'close'],
    methods: {
        handleSave() {
            if (!this.projectName.trim() || !this.centerName.trim()) {
                alert('请填写项目名称和中心名称');
                return;
            }
            this.$emit('save', {
                projectName: this.projectName.trim(),
                centerName: this.centerName.trim()
            });
            // 重置表单
            this.projectName = '';
            this.centerName = '';
        }
    }
};

// 删除确认模态框组件
const DeleteConfirmModal = {
    props: ['type', 'project', 'center'],
    template: `
        <div class="modal show" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">确认删除</h5>
                        <button type="button" class="btn-close" @click="$emit('close')"></button>
                    </div>
                    <div class="modal-body">
                        <p>{{ confirmMessage }}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="$emit('close')">取消</button>
                        <button type="button" class="btn btn-danger" @click="$emit('confirm')">确认删除</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    computed: {
        confirmMessage() {
            return this.type === 'project'
                ? `确定要删除项目"${this.project}"吗？这将同时删除该项目下的所有中心和受试者数据。`
                : `确定要删除"${this.project}"项目下的"${this.center}"中心吗？这将同时删除该中心下的所有受试者数据。`;
        }
    }
};

// 中心模态框组件
const CenterModal = {
    props: ['projectName'],
    template: `
        <div class="modal show" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">添加中心</h5>
                        <button type="button" class="btn-close" @click="$emit('close')"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">项目名称</label>
                            <input type="text" class="form-control" :value="projectName" disabled>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">中心名称</label>
                            <input type="text" class="form-control" v-model="centerName" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="$emit('close')">取消</button>
                        <button type="button" class="btn btn-primary" @click="handleSave">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            centerName: ''
        };
    },
    methods: {
        handleSave() {
            if (!this.centerName.trim()) {
                alert('请输入中心名称');
                return;
            }
            this.$emit('save', this.centerName.trim());
        }
    }
};

// 主应用
const app = Vue.createApp({
    components: {
        NavBar,
        ProjectList,
        ProjectModal,
        CenterModal,
        DeleteConfirmModal
    },
    data() {
        return {
            projects: new Map(),
            centerSubjectCounts: new Map(),
            showProjectModal: false,
            showCenterModal: false,
            showDeleteModal: false,
            selectedProject: '',
            deleteType: '',
            deleteProject: '',
            deleteCenter: ''
        };
    },
    async created() {
        await this.loadProjects();
    },
    methods: {
        async loadProjects() {
            try {
                const projects = await ProjectOperations.getAllProjects();
                const centers = await CenterOperations.getAllCenters();
                const subjects = await SubjectOperations.getAllSubjects();

                // 计算受试者数量
                this.centerSubjectCounts.clear();
                subjects.forEach(subject => {
                    const key = `${subject.project}-${subject.center}`;
                    this.centerSubjectCounts.set(key, (this.centerSubjectCounts.get(key) || 0) + 1);
                });

                // 组织项目数据
                this.projects.clear();
                projects.forEach(project => {
                    this.projects.set(project.projectName, new Set());
                });

                centers.forEach(center => {
                    if (this.projects.has(center.projectName)) {
                        this.projects.get(center.projectName).add(center.centerName);
                    }
                });
            } catch (error) {
                console.error('Error loading projects:', error);
                alert('加载项目列表失败');
            }
        },
        
        // 显示新建项目模态框
        showNewProjectModal() {
            this.showProjectModal = true;
        },

        // 显示新建中心模态框
        showNewCenterModal(projectName) {
            this.selectedProject = projectName;
            this.showCenterModal = true;
        },

        // 确认删除
        confirmDelete(type, project, center = '') {
            this.deleteType = type;
            this.deleteProject = project;
            this.deleteCenter = center;
            this.showDeleteModal = true;
        },

        // 处理删除操作
        async handleDelete() {
            try {
                if (this.deleteType === 'project') {
                    await ProjectOperations.deleteProject(this.deleteProject);
                } else {
                    await CenterOperations.deleteCenter(this.deleteProject, this.deleteCenter);
                }
                await this.loadProjects();
                this.showDeleteModal = false;
            } catch (error) {
                console.error('Delete error:', error);
                alert('删除失败，请重试');
            }
        },

        // 保存新项目
        async saveProject(projectData) {
            try {
                await ProjectOperations.addProject(projectData.projectName, projectData.centerName);
                await this.loadProjects();
                this.showProjectModal = false;
            } catch (error) {
                console.error('Error saving project:', error);
                alert('保存失败，请重试');
            }
        },

        // 保存新中心
        async saveCenter(centerName) {
            try {
                await CenterOperations.addCenter(this.selectedProject, centerName);
                await this.loadProjects();
                this.showCenterModal = false;
            } catch (error) {
                console.error('Error saving center:', error);
                alert('保存失败，请重试');
            }
        }
    }
});

app.mount('#app');
