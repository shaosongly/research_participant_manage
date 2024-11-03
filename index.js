let db;
const dbName = "SubjectsDB";

function openDB(version) {
    const request = indexedDB.open(dbName, version);

    request.onerror = function(event) {
        console.error("数据库错误: " + event.target.error);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("数据库打开成功，当前版本:", db.version);
        
        // 检查 subjects 存储空间是否存在
        if (!db.objectStoreNames.contains("subjects")) {
            console.log("subjects 存储空间不存在，准备重新创建...");
            // 关闭当前连接
            db.close();
            // 使用版本1重新创建数据库
            openDB(1);
        } else {
            console.log("subjects 存储空间存在，检查数据...");
            checkData();
        }
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        console.log("数据库升级中...");
        
        // 如果存储空间不存在，创建它
        if (!db.objectStoreNames.contains("subjects")) {
            const objectStore = db.createObjectStore("subjects", { 
                keyPath: "id", 
                autoIncrement: true 
            });
            objectStore.createIndex("name", "name", { unique: false });
            objectStore.createIndex("firstDate", "firstDate", { unique: false });
            console.log("subjects 存储空间创建成功");
        }
    };
}

// 初始化数据库
openDB();  // 首次调用不带版本号，尝试打开已存在的数据库

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
            checkData();
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
