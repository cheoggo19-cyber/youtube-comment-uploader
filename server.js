const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer();

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'file required' });
    }

    const form = new FormData();
    form.append('file', file.buffer, { filename: file.originalname });

    const response = await axios.post('https://api.anonfiles.com/upload', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return res.json(response.data);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    return res.status(500).json({
      error: 'upload failed',
      detail: err?.message || 'unknown error'
    });
  }
});

app.listen(3000, () => {
  console.log('Upload proxy running on http://localhost:3000');
});
