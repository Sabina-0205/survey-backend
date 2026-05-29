const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let surveyDatabase = [];

// 🚀 用「伺服器端 PUT」強行指定 ID 寫入官方
function forcePutToHapi(customId, fhirData) {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(fhirData);
        const options = {
            hostname: 'hapi.fhir.org',
            path: `/baseR4/QuestionnaireResponse/${customId}`,
            method: 'PUT', // 🌟 關鍵：用 PUT 才能指定 ID
            headers: {
                'Content-Type': 'application/fhir+json',
                'Content-Length': Buffer.byteLength(dataString)
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(true));
        });
        req.on('error', (err) => reject(err));
        req.write(dataString);
        req.end();
    });
}

app.post('/api/survey', async (req, res) => {
    try {
        const fhirResponse = req.body;
        // 🚀 生成 53 開頭的純數字 ID
        const finalPureId = "53" + Math.floor(100000 + Math.random() * 900000);
        fhirResponse.id = finalPureId;

        // 🌟 後端強行 PUT 到 HAPI 伺服器
        try {
            await forcePutToHapi(finalPureId, fhirResponse);
            console.log(`🎯 已強行將資源創建於 HAPI: ID ${finalPureId}`);
        } catch (e) {
            console.error("⚠️ HAPI 寫入失敗，但仍存入本地備份:", e.message);
        }

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
            id: finalPureId,
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
        res.json({ success: true, message: "OK" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/survey-list', (req, res) => {
    res.json({ success: true, data: surveyDatabase });
});

app.listen(PORT, () => console.log(`🚀 啟動於 PORT ${PORT}`));
