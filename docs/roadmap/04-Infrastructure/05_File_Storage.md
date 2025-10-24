# 📁 File Upload & Storage

> **S3/R2 integration, image processing, virus scan**

[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)

---

## Implementation

### AWS S3 Upload

```javascript
// src/services/upload.service.js
const AWS = require('aws-sdk');
const multer = require('multer');
const crypto = require('crypto');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

const uploadToS3 = async (file, tenantId) => {
  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const key = `${tenantId}/${Date.now()}-${file.originalname}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    Metadata: {
      'tenant-id': tenantId.toString(),
      'file-hash': fileHash
    }
  };

  const result = await s3.upload(params).promise();
  
  return {
    url: result.Location,
    key: result.Key,
    hash: fileHash
  };
};

module.exports = { upload, uploadToS3 };
```

### Route

```javascript
// src/routes/upload.js
const { upload, uploadToS3 } = require('../services/upload.service');

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const result = await uploadToS3(req.file, req.user.tenant_id);
    
    // Save to database
    await pool.query(
      'INSERT INTO core.files (tenant_id, uploaded_by, original_filename, filename, storage_path, mime_type, file_size, file_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.user.tenant_id, req.user.id, req.file.originalname, result.key, result.url, req.file.mimetype, req.file.size, result.hash]
    );

    res.json({ success: true, url: result.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Image Processing (Sharp)

```bash
npm install sharp
```

```javascript
const sharp = require('sharp');

const createThumbnail = async (buffer) => {
  return await sharp(buffer)
    .resize(200, 200, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();
};
```

**[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)**


