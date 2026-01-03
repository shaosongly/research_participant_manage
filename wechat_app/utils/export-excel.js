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

const writeFile = (filePath, data, encoding) =>
    new Promise((resolve, reject) => {
        const fs = wx.getFileSystemManager();
        const options = {
            filePath,
            data,
            success: () => resolve(filePath),
            fail: (err) => reject(err)
        };
        if (encoding) {
            options.encoding = encoding;
        }
        fs.writeFile(options);
    });

const openDocument = (filePath) =>
    new Promise((resolve, reject) => {
        wx.openDocument({
            filePath,
            showMenu: true,
            success: () => resolve(),
            fail: (err) => reject(err)
        });
    });

const sanitizeFileName = (name) =>
    String(name || 'visit_plan')
        .trim()
        .replace(/[\\/:*?"<>|\\s]+/g, '_')
        .slice(0, 50) || 'visit_plan';

const exportPlanFile = async ({ rows, fileName }) => {
    const safeName = sanitizeFileName(fileName);
    const basePath = wx.env.USER_DATA_PATH;
    const csvContent = '\uFEFF' + toCsv(rows);
    const csvPath = `${basePath}/${safeName}.csv`;
    await writeFile(csvPath, csvContent, 'utf-8');
    try {
        await openDocument(csvPath);
        return { filePath: csvPath, format: 'csv', opened: true, fileName: `${safeName}.csv` };
    } catch (error) {
        return {
            filePath: csvPath,
            format: 'csv',
            opened: false,
            fileName: `${safeName}.csv`,
            error
        };
    }
};

module.exports = {
    exportPlanFile,
    shareExportedFile: (filePath, fileName) =>
        new Promise((resolve, reject) => {
            if (!wx.canIUse || !wx.canIUse('shareFileMessage')) {
                reject(new Error('shareFileMessage not supported'));
                return;
            }
            wx.shareFileMessage({
                filePath,
                fileName,
                success: () => resolve(),
                fail: (err) => reject(err)
            });
        })
};
