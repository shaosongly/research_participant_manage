import { HolidayOverrideOperations } from '../common/db-operations.js';

const { createApp, ref, reactive, computed, onMounted } = Vue;

const HolidayManagePage = {
    template: '#holiday-manage-template',
    setup() {
        const overrides = ref([]);
        const loading = ref(false);
        const searchKeyword = ref('');
        const form = reactive({
            date: '',
            isHoliday: true,
            holidayName: ''
        });

        const normalizeDateKey = (value) => {
            if (!value) {
                return '';
            }
            const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
            if (isoPattern.test(value)) {
                return value;
            }
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return '';
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const resetForm = () => {
            form.date = '';
            form.isHoliday = true;
            form.holidayName = '';
        };

        const loadOverrides = async () => {
            try {
                loading.value = true;
                overrides.value = await HolidayOverrideOperations.getAllOverrides();
            } catch (error) {
                console.error('加载节假日数据失败:', error);
                alert('加载节假日数据失败: ' + error.message);
            } finally {
                loading.value = false;
            }
        };

        const saveOverride = async () => {
            try {
                const dateKey = normalizeDateKey(form.date);
                if (!dateKey) {
                    alert('请选择有效的日期');
                    return;
                }

                if (form.isHoliday && !form.holidayName.trim()) {
                    alert('请填写假日名称');
                    return;
                }

                await HolidayOverrideOperations.upsertOverride({
                    date: dateKey,
                    isHoliday: form.isHoliday,
                    holidayName: form.holidayName
                });

                await loadOverrides();
                resetForm();
            } catch (error) {
                console.error('保存节假日失败:', error);
                alert('保存节假日失败: ' + error.message);
            }
        };

        const deleteOverride = async (date) => {
            if (!date) {
                return;
            }
            const confirmed = confirm('确认删除这条节假日设置吗？');
            if (!confirmed) {
                return;
            }
            try {
                await HolidayOverrideOperations.deleteOverride(date);
                await loadOverrides();
            } catch (error) {
                console.error('删除节假日失败:', error);
                alert('删除节假日失败: ' + error.message);
            }
        };

        const filteredOverrides = computed(() => {
            if (!searchKeyword.value) {
                return overrides.value;
            }
            const keyword = searchKeyword.value.toLowerCase();
            return overrides.value.filter((item) => {
                const name = (item.holidayName || '').toLowerCase();
                return item.date.includes(keyword) || name.includes(keyword);
            });
        });

        const formatDate = (date) => {
            if (!date) {
                return '-';
            }
            const [year, month, day] = date.split('-');
            return `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`;
        };

        onMounted(async () => {
            await loadOverrides();
        });

        return {
            form,
            overrides,
            filteredOverrides,
            loading,
            searchKeyword,
            saveOverride,
            deleteOverride,
            loadOverrides,
            formatDate
        };
    }
};

const app = createApp({
    components: {
        'holiday-manage-page': HolidayManagePage
    }
});

app.mount('#app');
