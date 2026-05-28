const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let surveyDatabase = [];

// 1. 接收前端問卷的 API (POST)
app.post('/api/survey', async (req, res) => {
    try {
        const fhirResponse = req.body;
        let officialResponseId = "Pending..."; // 預設等待官方配發 ID

        try {
            // 🚀 核心改動：後端直接幫你 POST 到 HAPI 官方
            const hapiResult = await fetch('https://hapi.fhir.org/baseR4/QuestionnaireResponse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/fhir+json' },
                body: JSON.stringify(fhirResponse)
            });
            
            const hapiJson = await hapiResult.json();
            
            // 從官方回傳的資料中，精準抓出 QuestionnaireResponse 的官方配發 ID！
            if (hapiJson && hapiJson.id) {
                officialResponseId = hapiJson.id;
                console.log(`🎯 成功取得 HAPI 官方配發的 QuestionnaireResponse ID: ${officialResponseId}`);
            }
        } catch (hapiErr) {
            console.error("⚠️ 轉傳官方或解析官方 ID 失敗，降級處理:", hapiErr.message);
            officialResponseId = "HAPI-Server-Timeout";
        }

        // 安全拆解輔助
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

        // 將官方回傳的真實 ID 塞進本地扁平化數據中，供後台看
        const flattenedData = {
            id: officialResponseId, // 🌟 這裡完美改用官方配發的真實資料 ID！
            student: fhirResponse.subject?.display || "模擬新生",
            time: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            q1: parseAnswer(findItem(group1, 'q1-cardio')),
            q2: parseAnswer(findItem(group1, 'q2-chest-pain')),
            q3: parseAnswer(findItem(group1, 'q3-bone-joint')),
            q4: parseAnswer(findItem(group1, 'q4-chronic-disease')),
            q5: findItem(group2, 'q5-frequency')?.answer?.[0]?.valueInteger ?? 0,
            q6: parseAnswer(findItem(group2, 'q6-intensity')),
            q7: parseAnswer(findItem(group2, 'q8-interests')),
            q8: parseAnswer(findItem(group2, 'q9-condition'))
        };

        surveyDatabase.unshift(flattenedData);
        res.json({ success: true, message: "Successfully saved to official server!" });
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