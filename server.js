const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 在記憶體中建立一個乾淨的資料庫陣列
let surveyDatabase = [];

// 1. 接收前端問卷的 API (POST)
app.post('/api/survey', (req, res) => {
    try {
        const fhir = req.body;
        
        // 安全抓取群組的輔助函式
        const findItem = (items, linkId) => items ? items.find(i => i.linkId === linkId) : null;
        
        // 拆解 FHIR 結構裡面的各個 Item
        const group1 = fhir.item.find(i => i.linkId === 'group-1')?.item || [];
        const group2 = fhir.item.find(i => i.linkId === 'group-2')?.item || [];

        // 提取第 1~4 題
        const q1Item = findItem(group1, 'q1-cardio');
        const q2Item = findItem(group1, 'q2-chest-pain');
        const q3Item = findItem(group1, 'q3-bone-joint');
        const q4Item = findItem(group1, 'q4-chronic-disease');

        // 提取第 5~8 題
        const q5Item = findItem(group2, 'q5-frequency');
        const q6Item = findItem(group2, 'q6-intensity');
        const q7Item = findItem(group2, 'q8-interests');
        const q8Item = findItem(group2, 'q9-condition') || findItem(group2, 'q9-comment');

        // 輔助解析 answer 的值（自動相容單選字串與多選陣列）
        const parseAnswer = (item) => {
            if (!item || !item.answer) return "未填寫";
            return item.answer.map(ans => {
                if (ans.valueBoolean !== undefined) return ans.valueBoolean ? "⚠️ 是" : "否";
                if (ans.valueInteger !== undefined) return ans.valueInteger;
                return ans.valueString || "無";
            }).join(', ');
        };

        // 扁平化成管理端表格最愛讀取的乾淨格式
        const flattenedData = {
            id: "QR-" + Math.floor(100000 + Math.random() * 900000),
            student: fhir.subject?.display || "模擬新生",
            time: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            q1: parseAnswer(q1Item),
            q2: parseAnswer(q2Item),
            q3: parseAnswer(q3Item),
            q4: parseAnswer(q4Item),
            q5: q5Item?.answer?.[0]?.valueInteger ?? 0,
            q6: parseAnswer(q6Item),
            q7: parseAnswer(q7Item),
            q8: parseAnswer(q8Item)
        };

        surveyDatabase.unshift(flattenedData); // 最新提交的排在最前面
        console.log("成功存入一筆完整問卷:", flattenedData);
        
        res.json({ success: true, message: "FHIR QuestionnaireResponse saved successfully!" });
    } catch (err) {
        console.error("後端解析大崩潰:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. 讓管理端拉取完整列表的 API (GET)
app.get('/api/survey-list', (req, res) => {
    res.json({ success: true, data: surveyDatabase });
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`🚀 正牌 FHIR 伺服器已在連接埠 ${PORT} 順利通電啟動！`);
});