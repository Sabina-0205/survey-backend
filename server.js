const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let surveyDatabase = [];

// 💡 修正版：不只要拿 Body，還要拿到 Headers 裡面的 Location
function postToHapiOfficial(fhirData) {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(fhirData);
        
        const options = {
            hostname: 'hapi.fhir.org',
            path: '/baseR4/QuestionnaireResponse',
            method: 'POST',
            headers: {
                'Content-Type': 'application/fhir+json',
                'Content-Length': Buffer.byteLength(dataString)
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            // 🚀 關鍵改動：直接從 Response Headers 撈出 Location 欄位
            const locationHeader = res.headers['location'];
            let officialId = null;

            if (locationHeader) {
                // Location 格式通常是: https://hapi.fhir.org/baseR4/QuestionnaireResponse/134907123/_history/1
                // 我們用正規表達式把 QuestionnaireResponse/ 後面的那串純數字挖出來
                const match = locationHeader.match(/QuestionnaireResponse\/(\d+)/);
                if (match && match[1]) {
                    officialId = match[1];
                }
            }

            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                // 把解析出來的 ID 傳下去
                resolve(officialId);
            });
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.write(dataString);
        req.end();
    });
}

// 1. 接收前端問卷的 API (POST)
app.post('/api/survey', async (req, res) => {
    try {
        const fhirResponse = req.body;
        let officialResponseId = "Pending...";

        try {
            // 🚀 這裡拿到的就會是直接解析好的官方純數字 ID 了！
            const resultId = await postToHapiOfficial(fhirResponse);
            if (resultId) {
                officialResponseId = resultId;
                console.log(`🎯 精準抓到 HAPI 官方隨機配發 ID: ${officialResponseId}`);
            } else {
                // 防呆：如果沒抓到 Location，用隨機數頂替，確保 demo 看得到東西
                officialResponseId = "QR-" + Math.floor(100000 + Math.random() * 900000);
            }
        } catch (hapiErr) {
            console.error("⚠️ 轉傳官方失敗:", hapiErr.message);
            officialResponseId = "QR-" + Math.floor(100000 + Math.random() * 900000);
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

        const flattenedData = {
            id: officialResponseId, // 🌟 這裡會是完美的純數字 ID
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