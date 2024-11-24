import { ProjectOperations, CenterOperations, SubjectOperations } from '../common/db-operations.js';

// 导航栏组件
const NavBar = {
    template: '#nav-bar-template'
};

// 项目列表组件
const ProjectList = {
    props: ['projects', 'centerSubjectCounts'],
    template: '#project-list-template',
    methods: {
        getCenterSubjectCount(project, center) {
            return this.centerSubjectCounts.get(`${project}-${center}`) || 0;
        }
    }
};

// 项目模态框组件
const ProjectModal = {
    template: '#project-modal-template',
    data() {
        return {
            projectName: '',
            centerName: ''
        };
    },
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
            this.projectName = '';
            this.centerName = '';
        }
    }
};

// 中心模态框组件
const CenterModal = {
    template: '#center-modal-template',
    props: ['projectName'],
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

// 删除确认模态框组件
const DeleteConfirmModal = {
    template: '#delete-confirm-modal-template',
    props: ['type', 'project', 'center'],
    computed: {
        confirmMessage() {
            return this.type === 'project'
                ? `确定要删除项目"${this.project}"吗？这将同时删除该项目下的所有中心和受试者数据。`
                : `确定要删除"${this.project}"项目下的"${this.center}"中心吗？这将同时删除该中心下的所有受试者数据。`;
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
