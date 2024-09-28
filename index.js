let db;
const dbName = "SubjectsDB";

const request = indexedDB.open(dbName, 1);

request.onerror = function(event) {
    console.error("数据库错误: " + event.target.error);
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("数据库打开成功");
    checkData(); // 添加这行来检查数据
};

request.onupgradeneeded = function(event) {
    db = event.target.result;
    const objectStore = db.createObjectStore("subjects", { keyPath: "id", autoIncrement: true });
    objectStore.createIndex("name", "name", { unique: false });
    objectStore.createIndex("firstDate", "firstDate", { unique: false });
};

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('subjectForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        const transaction = db.transaction(["subjects"], "readwrite");
        const objectStore = transaction.objectStore("subjects");
        const request = objectStore.add(data);

        request.onsuccess = function(event) {
            console.log("数据已添加到数据库");
            alert("数据已成功保存!");
            e.target.reset();
            checkData(); // 添加这行来检查数据
        };

        request.onerror = function(event) {
            console.error("添加数据出错");
        };
    });
});

function checkData() {
    const transaction = db.transaction(["subjects"], "readonly");
    const objectStore = transaction.objectStore("subjects");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {
        const subjects = event.target.result;
        console.log("当前数据库中的所有受试者:", subjects);
    };

    request.onerror = function(event) {
        console.error("获取数据时出错");
    };
}
