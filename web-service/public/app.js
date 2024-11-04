let token = '';
const BASE_URL = "https://n11670339alb.cab432.com";
if (window.location.hash) {
    // Call getHashParams directly to check if tokens are in the URL fragment
    const params = getHashParams();
    const accessToken = params.access_token;
    // const idToken = params.id_token;

    if (accessToken) {
        // console.log('ID Token:', idToken);
        console.log('Access Token:', accessToken);

        // Store tokens in localStorage or handle accordingly
        localStorage.setItem('authToken', accessToken);
        showUploadSection();
        // localStorage.setItem('id_token', idToken);

        // Proceed with authenticated actions
    } else {
        console.log('No tokens found.');
    }
} else {
    console.log('No hash fragment found in the URL.');
}

// Add event listener to the login button
document.getElementById('loginButton').addEventListener('click', redirectToCognitoHostedUI);

// Function to redirect to Google login
function redirectToCognitoHostedUI() {
    const clientId = '5ai02nbenfalc2gh0s3rdot8r6';
    const domain = 'n11670339.auth.ap-southeast-2.amazoncognito.com';
    const redirectUri = 'https://n11670339alb.cab432.com';
    const responseType = 'token';

    const cognitoHostedUI = `https://${domain}/oauth2/authorize?identity_provider=Google&response_type=${responseType}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+profile+email`;
    window.location.href = cognitoHostedUI;
}

// Function to extract tokens from the URL fragment (after the #)
function getHashParams() {
    const hashParams = {};
    const fragment = window.location.hash.substring(1);
    const params = fragment.split('&');
    params.forEach(param => {
        const [key, value] = param.split('=');
        hashParams[key] = decodeURIComponent(value);
    });

    return hashParams;
}

// Function to handle user authentication (login or register)
async function handleAuth(action) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value;

    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }

    if (action === 'register' && !email) {
        alert('Please enter your email for registration');
        return;
    }

    try {
        const payload = {
            username,
            password
        };

        if (action === 'register') {
            payload.email = email;  // Include email only during registration
        }

        const response = await fetch(`${BASE_URL}/auth/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `${action} failed`);
        }

        if (action === 'register') {
            alert('Registration successful. You can now log in.');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            document.getElementById('email').value = '';
        } else {
            // Login successful
            token = data.token;
            localStorage.setItem('authToken', token); // Store token in localStorage
            showUploadSection();
        }
    } catch (error) {
        alert(error.message);
    }
}

// Function to show the upload section after successful login
function showUploadSection() {
    document.getElementById('authForm').classList.add('hidden');
    document.getElementById('uploadSection').classList.remove('hidden');
    fetchFiles();
}

// Function to display the authentication form
function showAuthForm() {
    document.getElementById('authForm').classList.remove('hidden');
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// Function to upload a file
async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file');
        return;
    }

    try {
        // Request the pre-signed URL from the server
        const response = await fetch(`${BASE_URL}/file/generate-upload-url`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
            }),
        });

        const { uploadUrl, s3Key } = await response.json();

        // Use the pre-signed URL to upload the file to S3 directly
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
            },
            body: file,
        });

        if (!uploadResponse.ok) {
            throw new Error('Upload to S3 failed');
        }
        await saveFileMetadata(s3Key, file.name);
        alert('File uploaded successfully');
        fetchFiles();

    } catch (error) {
        console.error('Upload failed:', error);
        alert('File upload failed');
    }
}

async function saveFileMetadata(s3Key, fileName) {
    const response = await fetch(`${BASE_URL}/file/save-metadata`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fileName,
            s3Key
        }),
    });

    if (!response.ok) {
        console.error('Failed to save metadata');
    }
}

// Function to fetch and display user's files
async function fetchFiles() {
    try {
        const response = await fetch(`${BASE_URL}/file/files`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch files');
        }

        const files = await response.json();
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        let hasTranscodingJobs = false;

        files.forEach(fileData => {
            const file = fileData.file;
            if (!file) return;

            const li = document.createElement('li');
            li.className = 'file-item';
            li.id = `${file.fileId}`;
            li.innerHTML = `
                <div class="file-name">${file.fileName}</div>
                <div class="file-info">Uploaded on: ${new Date(file.uploadDate).toLocaleString()}</div>
                <div class="file-actions">
                    <a class="btn btn-secondary" href="${file.downloadUrl}" download="${file.fileName}">Download</a>
                    <button onclick="deleteFile('${file.fileId}')" class="btn btn-secondary">Delete</button>
                    ${file.isVideo ? `<button onclick="previewVideo('${file.fileId}')" class="btn btn-secondary">Preview</button>` : ''}
                    ${file.isVideo ? `<button onclick="showTranscodeOptions('${file.fileId}')" class="btn btn-secondary">Transcode</button>` : ''}
                </div>
                ${file.isVideo ? `
                    <div id="transcodeOptions-${file.fileId}" class="transcode-options" style="display:none;">
                        <select id="format-${file.fileId}">
                            <option value="mp4">MP4</option>
                            <option value="webm">WebM</option>
                        </select>
                        <select id="quality-${file.fileId}">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                        <button onclick="startTranscoding('${file.fileId}')">Start Transcoding</button>
                    </div>
                ` : ''}
                <ul class="file-children">
                    ${fileData.transcodingJobs.map(job => `
                        <li class="transcoding-job" id="${job.transcodingId}">
                            <span>Transcoding to ${job.format} (${job.quality}): </span>
                            <span id="progress-text-${job.transcodingId}" class="progress">${job.progress}%</span>
                            <div class="progress-bar-container">
                                <div id="progress-bar-${job.transcodingId}" class="progress-bar" style="width: ${job.progress}%"></div>
                            </div>
                        </li>
                    `).join('')}
                    ${fileData.transcodedVersions.map(version => `
                        <li class="transcoded-version">
                            <span>Transcoded (${version.format} - ${version.quality})</span>
                            <a href="${version.downloadUrl}" download="${file.fileName.split('.')[0]}-${version.format}-${version.quality}.${version.format}">Download</a>
                        </li>
                    `).join('')}
                </ul>
            `;
            fileList.appendChild(li);
            if (fileData.transcodingJobs.length > 0) {
                hasTranscodingJobs = true;
            }
        });
        if (hasTranscodingJobs) {
            updateAllProgress();
        }
    } catch (error) {
        console.error('Error fetching files:', error);
    }
}

// Function to handle video preview with streaming
async function previewVideo(fileId) {
    try {
        const response = await fetch(`${BASE_URL}/file/stream/${fileId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch video URL');
        }

        const { signedUrl } = await response.json();

        const videoContainer = document.createElement('div');
        videoContainer.innerHTML = `
            <div class="video-container">
                <div>
                    <video controls style="max-width: 100%; max-height: 80vh;">
                        <source src="${signedUrl}" type="video/mp4">                    </video>
                    <button onclick="this.parentElement.parentElement.remove()" class="close-button">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(videoContainer);
    } catch (error) {
        console.error('Error fetching video:', error);
        alert('An error occurred while trying to play the video');
    }
}

// Function to close video preview
// function closePreview(fileId) {
//     const videoContainer = document.getElementById(`videoContainer-${fileId}`);
//     videoContainer.innerHTML = ''; // Clear the video player
//     videoContainer.classList.add('hidden');
// }

// Function to toggle transcoding options display
function showTranscodeOptions(fileId) {
    const optionsDiv = document.getElementById(`transcodeOptions-${fileId}`);
    optionsDiv.style.display = optionsDiv.style.display === 'none' ? 'block' : 'none';
}

// Function to start transcoding
async function startTranscoding(fileId) {
    const format = document.getElementById(`format-${fileId}`).value;
    const quality = document.getElementById(`quality-${fileId}`).value;

    try {
        const response = await fetch(`${BASE_URL}/transcode/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileId, format, quality }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to start transcoding');
        }

        const { message } = await response.json();
        alert(message);
        fetchFiles(); // Refresh file list after starting transcoding
    } catch (error) {
        alert('Failed to start transcoding: ' + error.message);
    }
}

// Function to delete a file
async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Delete failed');
        }

        alert('File deleted successfully');
        fetchFiles();
    } catch (error) {
        alert('Delete failed: ' + error.message);
    }
}

// Function to log out the user
function logout() {
    localStorage.removeItem('authToken');
    token = '';
    showAuthForm();
}

// Function to check authentication status on page load
function checkAuthStatus() {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
        token = storedToken;
        showUploadSection();
    }
}

// Function to update all progress bars
async function updateAllProgress() {
    const transcodingJobs = document.querySelectorAll('.transcoding-job');
    for (const job of transcodingJobs) {
        const jobId = job.id;
        // console.log(jobId);
        const fileId = job.closest('.file-item').id;
        // console.log(fileId);
        await pollTranscodingProgress(fileId, jobId);
    }
}

// Function to fetch and update job progress
function pollTranscodingProgress(fileId, transcodingId) {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${BASE_URL}/transcode/progress/${fileId}/${transcodingId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Job not found, assume it's completed
                    console.log('Transcoding job not found, assuming completed');
                    clearInterval(pollInterval);
                    fetchFiles();
                    return;
                }
                throw new Error('Failed to fetch progress');
            }

            const { progress } = await response.json();
            // console.log(progress);
            // Update progress bar
            updateProgressBar(transcodingId, progress);

            if (progress === 100 || progress === -1) {
                console.log('Transcoding completed or failed');
                clearInterval(pollInterval);
                // Wait a short time to ensure server-side operations are complete
                setTimeout(() => {
                    fetchFiles();
                }, 2000);
            }
        } catch (error) {
            console.error('Error polling transcoding progress:', error);
            clearInterval(pollInterval);
            // Attempt to refresh the file list in case of an error
            fetchFiles();
        }
    }, 2000); // Poll every 2 seconds
}

function updateProgressBar(transcodingId, progress) {
    const progressBarId = `progress-bar-${transcodingId}`;
    const progressTextId = `progress-text-${transcodingId}`;
    const progressBar = document.getElementById(progressBarId);
    const progressText = document.getElementById(progressTextId);
    if (progressBar && progressText) {
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
    }
}

// Initialize on page load
window.onload = checkAuthStatus;