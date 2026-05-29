const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let surveyDatabase = [];

app.post('/api/survey', async (req, res) => {
    try {
        const fhirResponse = req.body;
        
        // 🚀 後端直接接收前端已經配好的純數字 ID
        const finalId = fhirResponse.id || ("53" + Math.floor(100000 + Math.random() * 900000));

        const findItem = (items, linkId) => items ? items.find(i => i.linkId === linkId) : null;
        const group1 = fhirResponse.item?.find(i => i.linkId === 'group-1')?.item || [];
        const group2 = fhirResponse.item?.find(i => i.linkId === 'group-2')?.item || [];

        const parseAnswer = (item) => {
            if (!item || !item.answer) return "未填寫";
            return item.answer.map(ans => {
                if (ans.valueBoolean !== undefined) return ans.valueBoolean ? "是" : "否";
                if (ans.valueInteger !== undefined) return ans.valueInteger;
                return ans.valueString || "";
            }).join(', ');
        };

        const flattenedData = {
            id: finalId, // 🌟 完美的純數字 ID
            student: fhirResponse.subject?.display || "模擬新生",
            time: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            q1: parseAnswer(findItem(group1, 'q1-cardio')),
            q2: parseAnswer(findItem(group1, 'q2-chest-pain')),
            q3: parseAnswer(findItem(group1, 'q3-bone-joint')),
            q4: parseAnswer(findItem(group1, 'q4-chronic-disease')),
            q5: findItem(group2, 'q5-frequency')?.answer?.[0]?.valueInteger ?? 0,
            q6: parseAnswer(findItem(group2, 'q6-intensity')),
            q7: parseAnswer(findItem(group2, 'q7-interests') || findItem(group2, 'q8-interests')),
            q8: parseAnswer(findItem(group2, 'q9-condition'))
        };

        surveyDatabase.unshift(flattenedData);
        res.json({ success: true, message: "Successfully saved!" });
    } catch (err) {
        console.error("後端崩潰:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/survey-list', (req, res) => {
    res.json({ success: true, data: surveyDatabase });
});

app.listen(PORT, () => {
    console.log(`🚀 伺服器已在連接埠 ${PORT} 啟動！`);
});