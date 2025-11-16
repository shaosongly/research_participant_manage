import { VisitPlanSnapshotOperations } from '../common/db-operations.js';

const { createApp, ref, computed, onMounted } = Vue;

const VisitPlanHistory = {
    template: '#visit-plan-history-template',
    setup() {
        const snapshots = ref([]);
        const filters = ref({
            project: '',
            center: '',
            subject: ''
        });
        const selectedIds = ref([]);

        const projectOptions = ref([]);
        const centerOptions = ref([]);
        const subjectOptions = ref([]);

        const loadSnapshots = async () => {
            const data = await VisitPlanSnapshotOperations.getAllSnapshots();
            snapshots.value = data;
            deriveOptions();
        };

        const deriveOptions = () => {
            const projects = new Set();
            const centers = new Set();
            const subjects = new Set();

            snapshots.value.forEach((item) => {
                if (item.project) projects.add(item.project);
                if (item.center) centers.add(item.center);
                if (item.subjectName) subjects.add(item.subjectName);
            });

            projectOptions.value = Array.from(projects);
            centerOptions.value = Array.from(centers);
            subjectOptions.value = Array.from(subjects);
        };

        const filteredSnapshots = computed(() => {
            return snapshots.value.filter((item) => {
                const matchProject = !filters.value.project || item.project === filters.value.project;
                const matchCenter = !filters.value.center || item.center === filters.value.center;
                const matchSubject = !filters.value.subject || item.subjectName === filters.value.subject;
                return matchProject && matchCenter && matchSubject;
            });
        });

        const allSelected = computed(() => {
            const ids = filteredSnapshots.value.map((i) => i.id);
            return ids.length > 0 && ids.every((id) => selectedIds.value.includes(id));
        });

        const toggleSelectAll = (event) => {
            if (event.target.checked) {
                selectedIds.value = filteredSnapshots.value.map((i) => i.id);
            } else {
                selectedIds.value = [];
            }
        };

        const formatDate = (date) => {
            if (!date) return '-';
            const d = new Date(date);
            if (Number.isNaN(d.getTime())) return '-';
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}-${month}-${day}`;
        };

        const formatDateTime = (date) => {
            if (!date) return '-';
            const d = new Date(date);
            if (Number.isNaN(d.getTime())) return '-';
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            const minute = String(d.getMinutes()).padStart(2, '0');
            return `${d.getFullYear()}-${month}-${day} ${hour}:${minute}`;
        };

        const toCsv = (rows) =>
            rows
                .map((row) =>
                    row
                        .map((cell) => {
                            const value = String(cell ?? '');
                            return `"${value.replace(/"/g, '""')}"`;
                        })
                        .join(',')
                )
                .join('\r\n');

        const buildDetailColumns = (records) => {
            const visitNumbers = new Set();
            records.forEach((record) => {
                (record.unavoidableDetails || []).forEach((detail) => {
                    if (detail?.visitNumber) visitNumbers.add(detail.visitNumber);
                });
            });
            return Array.from(visitNumbers).sort((a, b) => a - b);
        };

        const exportSelected = () => {
            if (!selectedIds.value.length) return;
            const records = filteredSnapshots.value.filter((item) => selectedIds.value.includes(item.id));
            if (!records.length) return;

            const detailColumns = buildDetailColumns(records);
            const header = [
                '项目',
                '中心',
                '受试者',
                '访视间隔',
                '访视窗口',
                '首次访视日期',
                '总访视次数',
                '无法避开次数',
                '保存时间',
                ...detailColumns.map((num) => `第${num}次无法避开详情`)
            ];

            const rows = records.map((record) => {
                const detailMap = new Map();
                (record.unavoidableDetails || []).forEach((detail) => {
                const label = detail.visitLabel || `第${detail.visitNumber}次访视`;
                const texts = (detail.dates || []).map(
                    (d) => `${formatDate(d.dateISO || d)}·${d.holidayInfo || ''}`
                );
                detailMap.set(detail.visitNumber, `${label}: ${texts.join('; ')}`);
            });

                const detailCells = detailColumns.map((num) => detailMap.get(num) || '');

                return [
                    record.project || '',
                    record.center || '',
                    record.subjectName || '',
                    record.frequency || '',
                    record.visitWindow || '',
                    formatDate(record.firstVisitDate),
                    record.totalVisits ?? '',
                    record.unavoidableCount ?? '',
                    formatDateTime(record.createdAt),
                    ...detailCells
                ];
            });

            const csvContent = '\uFEFF' + toCsv([header, ...rows]);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            document.body.appendChild(link);
            link.href = url;
            link.download = `visit_plan_history_${formatDate(new Date())}.csv`;
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        const deleteSelected = async () => {
            if (!selectedIds.value.length) return;
            const confirmed = confirm('确定删除选中的记录吗？操作不可恢复。');
            if (!confirmed) return;
            await VisitPlanSnapshotOperations.deleteSnapshotsByIds(selectedIds.value);
            selectedIds.value = [];
            await loadSnapshots();
        };

        onMounted(async () => {
            await loadSnapshots();
        });

        return {
            snapshots,
            filters,
            selectedIds,
            projectOptions,
            centerOptions,
            subjectOptions,
            filteredSnapshots,
            allSelected,
            toggleSelectAll,
            formatDate,
            formatDateTime,
            exportSelected,
            deleteSelected
        };
    }
};

createApp({
    components: {
        'visit-plan-history': VisitPlanHistory
    }
}).mount('#app');
