import express from "express"
import {YtDlp} from "ytdlp-nodejs"

const router = express.Router();
const ytdlp = new YtDlp();

// Get Facebook content info
router.post('/info', async (req, res) => {
  try {
    const { url } = req.body;
    
    console.log('📱 [Facebook INFO] User requested info for URL:', url);
    
    if (!url) {
      console.log('❌ [Facebook INFO] No URL provided');
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
      console.log('❌ [Facebook INFO] Invalid Facebook URL:', url);
      return res.status(400).json({ error: 'Please provide a valid Facebook URL' });
    }

    console.log('📡 [Facebook INFO] Fetching content information...');
    
    const info = await ytdlp.getInfoAsync(url);

    console.log('✅ [Facebook INFO] Successfully fetched content info:', {
      title: info.title || 'Facebook Content',
      uploader: info.uploader || info.channel
    });

    const formatOptions = [
      { format_id: 'best', ext: 'mp4', quality: 'Best Quality', format_note: 'Best available quality' },
      { format_id: 'worst', ext: 'mp4', quality: 'Lower Quality', format_note: 'Smaller file size' }
    ];

    console.log('📋 [Facebook INFO] Available formats:', formatOptions.map(f => f.quality));

    res.json({
      title: info.title || 'Facebook Content',
      uploader: info.uploader || info.channel,
      duration: info.duration,
      thumbnail: info.thumbnail,
      description: info.description ? info.description.substring(0, 200) : '',
      formats: formatOptions
    });
  } catch (error) {
    console.error('❌ [Facebook INFO] Error getting Facebook info:', error.message);
    res.status(500).json({ error: 'Failed to get Facebook content information: ' + error.message });
  }
});

// Download Facebook content
router.post('/download', async (req, res) => {
  try {
    const { url, format_id } = req.body;
    
    console.log('⬇️ [Facebook DOWNLOAD] User requested download:', { url, format_id });
    
    if (!url) {
      console.log('❌ [Facebook DOWNLOAD] No URL provided');
      return res.status(400).json({ error: 'Facebook URL is required' });
    }

    if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
      console.log('❌ [Facebook DOWNLOAD] Invalid Facebook URL:', url);
      return res.status(400).json({ error: 'Please provide a valid Facebook URL' });
    }

    console.log('📡 [Facebook DOWNLOAD] Getting content info...');
    const info = await ytdlp.getInfoAsync(url);

    const safeTitle = (info.title || 'Facebook_Content').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50);
    
    console.log('📱 [Facebook DOWNLOAD] Starting download:', {
      title: info.title,
      format: format_id || 'best'
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);

    console.log('🚀 [Facebook DOWNLOAD] Starting download process...');

    try {
      const childProcess = ytdlp.exec(url, {
        format: format_id || 'best',
        output: '-'
      });
      
      childProcess.stdout?.pipe(res);
      
      childProcess.on('close', (code) => {
        console.log(`✅ [Facebook DOWNLOAD] Download completed with code: ${code}`);
      });
      
      childProcess.on('error', (error) => {
        console.error('❌ [Facebook DOWNLOAD] Process error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed: ' + error.message });
        }
      });
      
      childProcess.stderr?.on('data', (data) => {
        console.log('📊 [Facebook DOWNLOAD] Progress:', data.toString().trim());
      });
    } catch (execError) {
      console.error('❌ [Facebook DOWNLOAD] Failed to start download:', execError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start download: ' + execError.message });
      }
    }

  } catch (error) {
    console.error('❌ [Facebook DOWNLOAD] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download Facebook content: ' + error.message });
    }
  }
});

// Download Facebook Video
router.post('/video', async (req, res) => {
  try {
    const { url, format } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'Facebook Video URL is required' });
    }

    res.status(200).json({ 
      message: 'Facebook Video download would start here',
      url,
      format: format || 'best'
    });
  } catch (error) {
    console.error('Error downloading Facebook Video:', error);
    res.status(500).json({ error: 'Failed to download Facebook Video' });
  }
});

// Download Facebook Watch Video
router.post('/watch', async (req, res) => {
  try {
    const { url, format } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'Facebook Watch URL is required' });
    }

    res.status(200).json({ 
      message: 'Facebook Watch download would start here',
      url,
      format: format || 'best'
    });
  } catch (error) {
    console.error('Error downloading Facebook Watch:', error);
    res.status(500).json({ error: 'Failed to download Facebook Watch video' });
  }
});

export default router;
