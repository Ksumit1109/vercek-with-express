import express from "express"
import {YtDlp} from "ytdlp-nodejs"
import fetch from "node-fetch"

const router = express.Router();
const ytdlp = new YtDlp();

// RapidAPI configuration
const RAPIDAPI_KEY = 'fed10327bamsh5b07481a8d4b2d1p1f2993jsne736f5f9efe7';
const RAPIDAPI_HOST = 'instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com';
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

// Helper function to make RapidAPI requests for stories/highlights
async function makeRapidAPIRequest(url) {
  const rapidApiUrl = `${RAPIDAPI_BASE_URL}/convert?url=${encodeURIComponent(url)}`;
  
  console.log('🚀 [RapidAPI] Making request to:', rapidApiUrl);
  
  const response = await fetch(rapidApiUrl, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST
    }
  });
  
  if (!response.ok) {
    throw new Error(`RapidAPI request failed: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log('✅ [RapidAPI] Response received:', typeof result);
  
  return result;
}

// Helper function to get Instagram profile photo
async function getProfilePhoto(username) {
  console.log('🔍 [Profile Photo] Fetching profile photo for:', username);
  
  // First try: Use Instagram's JSON API endpoint
  try {
    const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (apiResponse.ok) {
      const apiData = await apiResponse.json();
      if (apiData && apiData.data && apiData.data.user && apiData.data.user.profile_pic_url_hd) {
        console.log('✅ [Profile Photo] Found profile picture via API:', apiData.data.user.profile_pic_url_hd);
        return apiData.data.user.profile_pic_url_hd;
      } else if (apiData && apiData.data && apiData.data.user && apiData.data.user.profile_pic_url) {
        console.log('✅ [Profile Photo] Found profile picture via API (standard):', apiData.data.user.profile_pic_url);
        return apiData.data.user.profile_pic_url;
      }
    }
  } catch (apiError) {
    console.log('⚠️ [Profile Photo] API method failed:', apiError.message);
  }
  
  // Second try: Use traditional web scraping
  const profileUrl = `https://www.instagram.com/${username}/`;
  
  try {
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Profile not found');
      }
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract profile picture URL from the HTML
    // Modern Instagram uses different JSON structures
    console.log('📄 [Profile Photo] Page content length:', html.length);
    
    // Try multiple patterns for profile picture URL
    const patterns = [
      // Standard profile pic URL
      /"profile_pic_url":"([^"]+)"/,
      // HD profile pic URL  
      /"profile_pic_url_hd":"([^"]+)"/,
      // Alternative JSON structure
      /"ProfilePicture"[^}]+"url":"([^"]+)"/,
      // Meta property
      /<meta property="og:image" content="([^"]+)"/,
      // Another meta tag format
      /<meta name="twitter:image" content="([^"]+)"/,
      // JSON LD format
      /"image"[^}]*"url":"([^"]+)"/,
      // Direct image URL pattern
      /https:\/\/[^"]*\.cdninstagram\.com\/v\/[^"]*\.jpg[^"]*(?=")/g,
      // Instagram profile image pattern
      /https:\/\/[^"]*instagram[^"]*\.jpg[^"]*(?=")/g
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let profilePicUrl = match[1];
        // Decode escaped characters
        profilePicUrl = profilePicUrl.replace(/\\u0026/g, '&')
                                   .replace(/\\u003d/g, '=')
                                   .replace(/\\\\/g, '/')
                                   .replace(/\\u002F/g, '/');
        
        // Validate that it's actually an image URL
        if (profilePicUrl.includes('.jpg') || profilePicUrl.includes('.jpeg') || profilePicUrl.includes('.png')) {
          console.log('✅ [Profile Photo] Found profile picture URL:', profilePicUrl);
          return profilePicUrl;
        }
      }
    }
    
    // If all regex patterns fail, try to extract from window._sharedData or other JS objects
    console.log('🔍 [Profile Photo] Trying fallback extraction methods...');
    
    // Look for window._sharedData
    const sharedDataMatch = html.match(/window\._sharedData = ({.+?});/);
    if (sharedDataMatch) {
      try {
        const sharedData = JSON.parse(sharedDataMatch[1]);
        console.log('🔍 [Profile Photo] Found _sharedData');
        
        // Try to find profile pic in various nested locations
        const searchInObject = (obj, depth = 0) => {
          if (depth > 5) return null; // Prevent infinite recursion
          
          if (typeof obj !== 'object' || obj === null) return null;
          
          for (const key in obj) {
            if (key.includes('profile_pic') && typeof obj[key] === 'string' && obj[key].includes('.jpg')) {
              return obj[key];
            }
            
            if (typeof obj[key] === 'object') {
              const found = searchInObject(obj[key], depth + 1);
              if (found) return found;
            }
          }
          
          return null;
        };
        
        const foundUrl = searchInObject(sharedData);
        if (foundUrl) {
          console.log('✅ [Profile Photo] Found profile picture URL in _sharedData:', foundUrl);
          return foundUrl;
        }
      } catch (e) {
        console.log('⚠️ [Profile Photo] Failed to parse _sharedData:', e.message);
      }
    }
    
    // Final attempt: look for any Instagram CDN image URLs in the content
    const cdnMatches = html.match(/https:\/\/[^"\s]*instagram[^"\s]*\.jpg[^"\s]*/gi);
    if (cdnMatches && cdnMatches.length > 0) {
      // Filter for profile picture URLs (they often have specific patterns)
      const profilePics = cdnMatches.filter(url => 
        url.includes('profile') || 
        url.includes('150x150') ||
        url.includes('320x320')
      );
      
      if (profilePics.length > 0) {
        console.log('✅ [Profile Photo] Found profile picture URL via CDN search:', profilePics[0]);
        return profilePics[0];
      }
      
      // If no specific profile pic found, use the first Instagram image
      console.log('✅ [Profile Photo] Using first Instagram CDN image:', cdnMatches[0]);
      return cdnMatches[0];
    }
    
    throw new Error('Profile picture URL not found in page content');
    
  } catch (error) {
    console.error('❌ [Profile Photo] Error fetching profile photo:', error.message);
    throw error;
  }
}

// Helper function to download file from URL
async function downloadFromUrl(fileUrl, res, filename) {
  console.log('📥 [Download] Downloading from URL:', fileUrl);
  
  const response = await fetch(fileUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  
  // Set appropriate headers
  res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Pipe the response to the client
  response.body?.pipe(res);
  
  console.log('✅ [Download] File streaming started');
}

// Get Instagram content info
router.post('/info', async (req, res) => {
  try {
    const { url } = req.body;
    
    console.log('📷 [Instagram INFO] User requested info for URL:', url);
    
    if (!url) {
      console.log('❌ [Instagram INFO] No URL provided');
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!url.includes('instagram.com')) {
      console.log('❌ [Instagram INFO] Invalid Instagram URL:', url);
      return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    console.log('📡 [Instagram INFO] Fetching content information...');
    
    const info = await ytdlp.getInfoAsync(url);

    console.log('✅ [Instagram INFO] Successfully fetched content info:', {
      title: info.title || 'Instagram Content',
      uploader: info.uploader || info.channel
    });

    // Simplified format options for Instagram
    const formatOptions = [
      { format_id: 'best', ext: 'mp4', quality: 'Best Quality', format_note: 'Best available quality' },
      { format_id: 'worst', ext: 'mp4', quality: 'Lower Quality', format_note: 'Smaller file size' }
    ];

    console.log('📋 [Instagram INFO] Available formats:', formatOptions.map(f => f.quality));

    res.json({
      title: info.title || 'Instagram Content',
      uploader: info.uploader || info.channel,
      duration: info.duration,
      thumbnail: info.thumbnail,
      description: info.description ? info.description.substring(0, 200) : '',
      formats: formatOptions
    });
  } catch (error) {
    console.error('❌ [Instagram INFO] Error getting Instagram info:', error.message);
    res.status(500).json({ error: 'Failed to get Instagram content information: ' + error.message });
  }
});

// Download Instagram content (Reel, Post, etc.)
router.post('/download', async (req, res) => {
  try {
    const { url, format_id } = req.body;
    
    console.log('⬇️ [Instagram DOWNLOAD] User requested download:', { url, format_id });
    
    if (!url) {
      console.log('❌ [Instagram DOWNLOAD] No URL provided');
      return res.status(400).json({ error: 'Instagram URL is required' });
    }

    if (!url.includes('instagram.com')) {
      console.log('❌ [Instagram DOWNLOAD] Invalid Instagram URL:', url);
      return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    console.log('📡 [Instagram DOWNLOAD] Getting content info...');
    const info = await ytdlp.getInfoAsync(url);

    const safeTitle = (info.title || 'Instagram_Content').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50);
    
    console.log('📷 [Instagram DOWNLOAD] Starting download:', {
      title: info.title,
      format: format_id || 'best'
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);

    console.log('🚀 [Instagram DOWNLOAD] Starting download process...');

    try {
      // Use exec to pipe directly to response
      const childProcess = ytdlp.exec(url, {
        format: format_id || 'best',
        output: '-' // Output to stdout
      });
      
      childProcess.stdout?.pipe(res);
      
      childProcess.on('close', (code) => {
        console.log(`✅ [Instagram DOWNLOAD] Download completed with code: ${code}`);
      });
      
      childProcess.on('error', (error) => {
        console.error('❌ [Instagram DOWNLOAD] Process error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed: ' + error.message });
        }
      });
      
      childProcess.stderr?.on('data', (data) => {
        console.log('📊 [Instagram DOWNLOAD] Progress:', data.toString().trim());
      });
    } catch (execError) {
      console.error('❌ [Instagram DOWNLOAD] Failed to start download:', execError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start download: ' + execError.message });
      }
    }

  } catch (error) {
    console.error('❌ [Instagram DOWNLOAD] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download Instagram content: ' + error.message });
    }
  }
});

// Download Instagram Story
router.post('/story', async (req, res) => {
  try {
    const { url, format_id } = req.body;
    
    console.log('📷 [Instagram STORY] User requested download:', { url, format_id });
    
    if (!url) {
      console.log('❌ [Instagram STORY] No URL provided');
      return res.status(400).json({ error: 'Instagram Story URL is required' });
    }

    if (!url.includes('instagram.com')) {
      console.log('❌ [Instagram STORY] Invalid Instagram URL:', url);
      return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    // Validate story URL format
    if (!url.includes('/stories/')) {
      console.log('❌ [Instagram STORY] URL is not a story URL:', url);
      return res.status(400).json({ 
        error: 'This does not appear to be an Instagram Story URL',
        details: 'Story URLs should contain "/stories/" (e.g., https://www.instagram.com/stories/username/123456789/)'
      });
    }

    console.log('🚀 [Instagram STORY] Getting download info from RapidAPI...');

    try {
      // Use RapidAPI to get download links
      const result = await makeRapidAPIRequest(url);
      
      console.log('📊 [Instagram STORY] RapidAPI response:', result);
      
      // Check if result contains download URL
      let downloadUrl = null;
      let filename = `Instagram_Story_${Date.now()}`;
      
      if (result && typeof result === 'object') {
        const apiResult = result;
        
        // Handle RapidAPI response structure with media array
        if (apiResult.media && Array.isArray(apiResult.media) && apiResult.media.length > 0) {
          // Find the first video (mp4) format
          const videoMedia = apiResult.media.find((media) => media.type === 'mp4');
          if (videoMedia && videoMedia.url) {
            downloadUrl = videoMedia.url;
          }
        }
        
        // Fallback: Try other possible property names for download URL
        if (!downloadUrl) {
          downloadUrl = apiResult.download_url || apiResult.url || apiResult.video_url || apiResult.story_url || apiResult.media_url;
        }
        
        // Try to get a better filename if available
        if (apiResult.title) {
          filename = apiResult.title.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50) || filename;
        }
      }
      
      if (!downloadUrl) {
        console.log('❌ [Instagram STORY] No download URL found in RapidAPI response');
        return res.status(404).json({ 
          error: 'Story download URL not found',
          details: 'The story may have expired, been deleted, or is from a private account'
        });
      }
      
      console.log('📥 [Instagram STORY] Downloading from URL:', downloadUrl);
      
      // Download the file from the URL provided by RapidAPI
      await downloadFromUrl(downloadUrl, res, `${filename}.mp4`);
      
      console.log('✅ [Instagram STORY] Download completed successfully');
      
    } catch (execError) {
      console.error('❌ [Instagram STORY] Failed to start download:', execError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start story download: ' + execError.message });
      }
    }

  } catch (error) {
    console.error('❌ [Instagram STORY] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download Instagram Story: ' + error.message });
    }
  }
});

// Download Instagram Photo
router.post('/photo', async (req, res) => {
  try {
    const { url, format_id } = req.body;
    
    console.log('📸 [Instagram PHOTO] User requested download:', { url, format_id });
    
    if (!url) {
      console.log('❌ [Instagram PHOTO] No URL provided');
      return res.status(400).json({ error: 'Instagram Photo URL is required' });
    }

    if (!url.includes('instagram.com')) {
      console.log('❌ [Instagram PHOTO] Invalid Instagram URL:', url);
      return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    console.log('📡 [Instagram PHOTO] Getting content info...');
    const info = await ytdlp.getInfoAsync(url);

    const safeTitle = (info.title || 'Instagram_Photo').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50);
    
    console.log('📸 [Instagram PHOTO] Starting download:', {
      title: info.title,
      format: format_id || 'best'
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.jpg"`);

    console.log('🚀 [Instagram PHOTO] Starting download process...');

    try {
      // Use exec to pipe directly to response
      const childProcess = ytdlp.exec(url, {
        format: format_id || 'best',
        output: '-' // Output to stdout
      });
      
      childProcess.stdout?.pipe(res);
      
      childProcess.on('close', (code) => {
        console.log(`✅ [Instagram PHOTO] Download completed with code: ${code}`);
      });
      
      childProcess.on('error', (error) => {
        console.error('❌ [Instagram PHOTO] Process error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Photo download failed: ' + error.message });
        }
      });
      
      childProcess.stderr?.on('data', (data) => {
        console.log('📊 [Instagram PHOTO] Progress:', data.toString().trim());
      });
    } catch (execError) {
      console.error('❌ [Instagram PHOTO] Failed to start download:', execError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start download: ' + execError.message });
      }
    }

  } catch (error) {
    console.error('❌ [Instagram PHOTO] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download Instagram Photo: ' + error.message });
    }
  }
});

// Download Instagram Story Highlights
router.post('/highlights', async (req, res) => {
  try {
    const { url, format_id } = req.body;
    
    console.log('🌟 [Instagram HIGHLIGHTS] User requested download:', { url, format_id });
    
    if (!url) {
      console.log('❌ [Instagram HIGHLIGHTS] No URL provided');
      return res.status(400).json({ error: 'Instagram Story Highlights URL is required' });
    }

    if (!url.includes('instagram.com')) {
      console.log('❌ [Instagram HIGHLIGHTS] Invalid Instagram URL:', url);
      return res.status(400).json({ error: 'Please provide a valid Instagram URL' });
    }

    // Validate highlights URL format
    if (!url.includes('/highlights/') && !url.includes('stories/highlights/')) {
      console.log('❌ [Instagram HIGHLIGHTS] URL is not a highlights URL:', url);
      return res.status(400).json({ 
        error: 'This does not appear to be an Instagram Highlights URL',
        details: 'Highlights URLs should contain "/highlights/" or "stories/highlights/"'
      });
    }

    console.log('🚀 [Instagram HIGHLIGHTS] Getting download info from RapidAPI...');

    try {
      // Use RapidAPI to get download links
      const result = await makeRapidAPIRequest(url);
      
      console.log('📊 [Instagram HIGHLIGHTS] RapidAPI response:', result);
      
      // Check if result contains download URL
      let downloadUrl = null;
      let filename = `Instagram_Highlights_${Date.now()}`;
      
      if (result && typeof result === 'object') {
        const apiResult = result;
        
        // Handle RapidAPI response structure with media array
        if (apiResult.media && Array.isArray(apiResult.media) && apiResult.media.length > 0) {
          // Find the first video (mp4) format
          const videoMedia = apiResult.media.find((media) => media.type === 'mp4');
          if (videoMedia && videoMedia.url) {
            downloadUrl = videoMedia.url;
          }
        }
        
        // Fallback: Try other possible property names for download URL
        if (!downloadUrl) {
          downloadUrl = apiResult.download_url || apiResult.url || apiResult.video_url || apiResult.highlights_url || apiResult.media_url;
        }
        
        // Try to get a better filename if available
        if (apiResult.title) {
          filename = apiResult.title.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50) || filename;
        }
      }
      
      if (!downloadUrl) {
        console.log('❌ [Instagram HIGHLIGHTS] No download URL found in RapidAPI response');
        return res.status(404).json({ 
          error: 'Highlights download URL not found',
          details: 'The highlights may have been removed, deleted, or are from a private account'
        });
      }
      
      console.log('📥 [Instagram HIGHLIGHTS] Downloading from URL:', downloadUrl);
      
      // Download the file from the URL provided by RapidAPI
      await downloadFromUrl(downloadUrl, res, `${filename}.mp4`);
      
      console.log('✅ [Instagram HIGHLIGHTS] Download completed successfully');
      
    } catch (execError) {
      console.error('❌ [Instagram HIGHLIGHTS] Failed to start download:', execError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start highlights download: ' + execError.message });
      }
    }

  } catch (error) {
    console.error('❌ [Instagram HIGHLIGHTS] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download Instagram Highlights: ' + error.message });
    }
  }
});

// Download Instagram Profile Photo
router.post('/profile', async (req, res) => {
  try {
    const { username } = req.body;
    
    console.log('📸 [Instagram PROFILE] User requested profile photo download:', { username });
    
    if (!username) {
      console.log('❌ [Instagram PROFILE] No username provided');
      return res.status(400).json({ error: 'Instagram username is required' });
    }

    // Clean username - remove URL parts if provided
    let cleanUsername = username;
    if (username.includes('instagram.com/')) {
      const match = username.match(/instagram\.com\/([^/]+)/);
      if (match) cleanUsername = match[1];
    }
    
    // Remove @ symbol if present
    cleanUsername = cleanUsername.replace('@', '');
    
    const profileUrl = `https://www.instagram.com/${cleanUsername}/`;
    console.log('🚀 [Instagram PROFILE] Getting profile photo from RapidAPI for:', profileUrl);

    try {
      // Use our specialized function to get profile photo URL
      const downloadUrl = await getProfilePhoto(cleanUsername);
      
      const safeUsername = cleanUsername.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50);
      
      console.log('📥 [Instagram PROFILE] Downloading profile photo from URL:', downloadUrl);
      
      // Download the profile photo from the URL
      await downloadFromUrl(downloadUrl, res, `${safeUsername}_profile_photo.jpg`);
      
      console.log('✅ [Instagram PROFILE] Profile photo download completed successfully');
      
    } catch (profileError) {
      console.error('❌ [Instagram PROFILE] Profile fetch error:', profileError.message);
      
      if (profileError.message.includes('Profile not found') || profileError.message.includes('404')) {
        return res.status(404).json({ 
          error: 'Instagram profile not found',
          details: `The username "${cleanUsername}" does not exist or has been deactivated.`
        });
      } else if (profileError.message.includes('403') || profileError.message.includes('private')) {
        return res.status(403).json({ 
          error: 'This Instagram profile is private',
          details: 'Private Instagram profiles cannot be accessed. Only public profile photos can be downloaded.'
        });
      } else {
        return res.status(500).json({ 
          error: 'Failed to access Instagram profile',
          details: profileError.message.substring(0, 200)
        });
      }
    }

  } catch (error) {
    console.error('❌ [Instagram PROFILE] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download profile photo: ' + error.message });
    }
  }
});

export default router;
