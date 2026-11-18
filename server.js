const express = require('express');
const multer  = require('multer');
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const app    = express();
const upload = multer({ dest: os.tmpdir() });

// API key — Android app mein bhi yahi hoga
const API_KEY = process.env.API_KEY || 'howler_sign_2024';

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Howler APK Sign Server' });
});

// Sign endpoint
app.post('/sign', upload.single('apk'), (req, res) => {

    // API key check
    if (req.headers['x-api-key'] !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No APK file received' });
    }

    const inputApk = req.file.path;
    const outDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'howler-'));
    const jarPath  = path.join(__dirname, 'uber-apk-signer.jar');

    if (!fs.existsSync(jarPath)) {
        fs.unlinkSync(inputApk);
        return res.status(500).json({ error: 'uber-apk-signer.jar not found on server' });
    }

    const cmd = `java -jar "${jarPath}" --apks "${inputApk}" --out "${outDir}" --allowResign`;

    exec(cmd, { timeout: 90000 }, (err, stdout, stderr) => {

        // Input clean karo
        try { fs.unlinkSync(inputApk); } catch(e) {}

        if (err) {
            try { fs.rmSync(outDir, { recursive: true }); } catch(e) {}
            return res.status(500).json({ error: stderr || err.message });
        }

        // Signed APK dhundo
        let signedFile = null;
        try {
            const files = fs.readdirSync(outDir);
            const found = files.find(f => f.endsWith('.apk'));
            if (found) signedFile = path.join(outDir, found);
        } catch(e) {}

        if (!signedFile) {
            try { fs.rmSync(outDir, { recursive: true }); } catch(e) {}
            return res.status(500).json({ error: 'Signed APK not produced' });
        }

        // Send signed APK bytes directly
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="signed.apk"');

        const stream = fs.createReadStream(signedFile);
        stream.on('end', () => {
            try { fs.rmSync(outDir, { recursive: true }); } catch(e) {}
        });
        stream.on('error', () => {
            try { fs.rmSync(outDir, { recursive: true }); } catch(e) {}
        });
        stream.pipe(res);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Howler Sign Server running on port ' + PORT);
});