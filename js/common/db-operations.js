const Dexie = window.Dexie;

// 创建数据库类
class ResearchDB extends Dexie {
    constructor() {
        super('ResearchDB');

        // 定义数据库结构
        this.version(2).stores({
            projects: 'projectName, createTime',
            centers: '[projectName+centerName], projectName, createTime',
            subjects: '[project+center+name], project, center, name, *projectCenter',
            visitRecords: '[project+center+subjectName+visitNumber], project, center, subjectName, visitDate, *projectCenterSubject'
        });
    }
}

// 创建数据库实例
const db = new ResearchDB();

// 项目相关操作
const ProjectOperations = {
    async addProject(projectName, centerName) {
        return db.transaction('rw', [db.projects, db.centers], async () => {
            // 检查项目是否存在
            const existingProject = await db.projects.get(projectName);
            if (existingProject) {
                throw new Error('项目已存在');
            }

            // 添加项目和初始中心
            await db.projects.add({
                projectName,
                createTime: new Date()
            });

            await db.centers.add({
                projectName,
                centerName,
                createTime: new Date()
            });
        });
    },

    async getAllProjects() {
        return db.projects.toArray();
    },

    async deleteProject(projectName) {
        return db.transaction('rw', [db.projects, db.centers, db.subjects, db.visitRecords], async () => {
            // 删除相关的访视记录
            await db.visitRecords.where('project').equals(projectName).delete();

            // 删除相关的受试者
            await db.subjects.where('project').equals(projectName).delete();

            // 删除相关的中心
            await db.centers.where('projectName').equals(projectName).delete();

            // 删除项目
            await db.projects.delete(projectName);
        });
    }
};

// 中心相关操作
const CenterOperations = {
    async addCenter(projectName, centerName) {
        return db.centers.add({
            projectName,
            centerName,
            createTime: new Date()
        });
    },

    async getAllCenters() {
        return db.centers.toArray();
    },

    async getCentersForProject(projectName) {
        return db.centers.where('projectName').equals(projectName).toArray();
    },

    async deleteCenter(projectName, centerName) {
        return db.transaction('rw', [db.centers, db.subjects, db.visitRecords], async () => {
            // 删除相关的访视记录
            await db.visitRecords
                .where(['project', 'center'])
                .equals([projectName, centerName])
                .delete();

            // 删除相关的受试者
            await db.subjects
                .where(['project', 'center'])
                .equals([projectName, centerName])
                .delete();

            // 删除中心
            await db.centers.delete([projectName, centerName]);
        });
    }
};

// 受试者相关操作
const SubjectOperations = {
    async addSubject(subjectData) {
        return db.subjects.add(subjectData);
    },

    async updateSubject(subjectData) {
        return db.subjects.put(subjectData);
    },

    async getSubject(project, center, name) {
        return db.subjects.get([project, center, name]);
    },

    async getAllSubjects() {
        return db.subjects.toArray();
    },

    async getSubjectsForProjectCenter(project, center) {
        return db.subjects
            .where(['project', 'center'])
            .equals([project, center])
            .toArray();
    },

    async deleteSubject(project, center, name) {
        return db.transaction('rw', [db.subjects, db.visitRecords], async () => {
            // 删除相关的访视记录
            await db.visitRecords
                .where(['project', 'center', 'subjectName'])
                .equals([project, center, name])
                .delete();

            // 删除受试者
            await db.subjects.delete([project, center, name]);
        });
    }
};

// 访视记录相关操作
const VisitRecordOperations = {
    // 添加单条访视记录
    async addVisitRecord(visitData) {
        return db.visitRecords.add({
            project: visitData.project,
            center: visitData.center,
            subjectName: visitData.subjectName,
            visitNumber: visitData.visitNumber,
            visitDate: visitData.visitDate,
            // 添加复合索引
            projectCenterSubject: [visitData.project, visitData.center, visitData.subjectName]
        });
    },

    // 批量添加访视记录
    async batchAddVisitRecords(records) {
        return db.transaction('rw', db.visitRecords, async () => {
            for (const record of records) {
                await db.visitRecords.add({
                    ...record,
                    projectCenterSubject: [record.project, record.center, record.subjectName]
                });
            }
        });
    },

    // 更新访视记录
    async updateVisitRecord(visitData) {
        return db.visitRecords.put({
            ...visitData,
            projectCenterSubject: [visitData.project, visitData.center, visitData.subjectName]
        });
    },

    // 获取所有访视记录
    async getAllVisitRecords() {
        return db.visitRecords.toArray();
    },

    // 获取特定受试者的访视记录
    async getVisitRecordsForSubject(project, center, subjectName) {
        return db.visitRecords
            .where('projectCenterSubject')
            .equals([project, center, subjectName])
            .toArray();
    },

    // 获取筛选后的访视记录
    async getFilteredVisitRecords(filters = {}) {
        try {
            // 如果没有任何筛选条件，返回所有记录
            if (!filters.project && !filters.center && !filters.subject) {
                return await db.visitRecords.toArray();
            }

            // 如果有项目和中心筛选条件
            if (filters.project && filters.center) {
                let query = db.visitRecords
                    .where(['project', 'center'])
                    .equals([filters.project, filters.center]);

                // 如果还有受试者筛选条件
                if (filters.subject) {
                    return query.filter(record => record.subjectName === filters.subject).toArray();
                }

                return query.toArray();
            }

            // 如果只有项目筛选
            if (filters.project) {
                return await db.visitRecords
                    .where('project')
                    .equals(filters.project)
                    .toArray();
            }

            // 获取所有记录并在内存中筛选
            let records = await db.visitRecords.toArray();

            // 应用筛选条件
            if (filters.center) {
                records = records.filter(record => record.center === filters.center);
            }
            if (filters.subject) {
                records = records.filter(record => record.subjectName === filters.subject);
            }

            return records;
        } catch (error) {
            console.error('访视记录筛选失败:', error);
            throw new Error('访视记录筛选失败: ' + error.message);
        }
    },

    // 删除单条访视记录
    async deleteVisitRecord(record) {
        return db.visitRecords.delete([
            record.project,
            record.center,
            record.subjectName,
            record.visitNumber
        ]);
    },

    // 批量删除访视记录
    async batchDeleteVisitRecords(records) {
        return db.transaction('rw', db.visitRecords, async () => {
            for (const record of records) {
                await db.visitRecords.delete([
                    record.project,
                    record.center,
                    record.subjectName,
                    record.visitNumber
                ]);
            }
        });
    }
};

export {
    db,
    ProjectOperations,
    CenterOperations,
    SubjectOperations,
    VisitRecordOperations
}; 