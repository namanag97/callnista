document.addEventListener('DOMContentLoaded', function() {
    // Initialize Feather icons (single initialization)
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Upload modal functionality
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadModal = document.getElementById('uploadModal');
    
    if (uploadBtn && uploadModal) {
        const closeModal = document.getElementById('closeModal');
        const cancelUpload = document.getElementById('cancelUpload');
        const dropArea = document.getElementById('dropArea');
        const fileInput = document.getElementById('fileInput');
        
        uploadBtn.addEventListener('click', function() {
            uploadModal.style.display = 'flex';
        });
        
        if (closeModal) {
            closeModal.addEventListener('click', function() {
                uploadModal.style.display = 'none';
            });
        }
        
        if (cancelUpload) {
            cancelUpload.addEventListener('click', function() {
                uploadModal.style.display = 'none';
            });
        }
        
        if (dropArea && fileInput) {
            dropArea.addEventListener('click', function() {
                fileInput.click();
            });
            
            // Handle file selection
            fileInput.addEventListener('change', function() {
                if (this.files.length > 0) {
                    const formData = new FormData();
                    for (const file of this.files) {
                        formData.append('audioFiles', file);
                    }
                    
                    // Get other form data if available
                    const processingQueue = document.querySelector('select[name="processingQueue"]');
                    const tags = document.querySelector('input[name="tags"]');
                    
                    if (processingQueue) {
                        formData.append('processingQueue', processingQueue.value);
                    }
                    
                    if (tags) {
                        formData.append('tags', tags.value);
                    }
                    
                    // Submit the form via AJAX
                    fetch('/uploads', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log('Upload successful:', data);
                        // Show success message or redirect
                        if (uploadModal) {
                            uploadModal.style.display = 'none';
                        }
                        showNotification('Files uploaded successfully!', 'success');
                        // Optionally reload the page after a delay
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    })
                    .catch(error => {
                        console.error('Upload error:', error);
                        showNotification('Upload failed. Please try again.', 'error');
                    });
                }
            });
            
            // Handle drag and drop functionality
            dropArea.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.classList.add('border-primary');
            });
            
            dropArea.addEventListener('dragleave', function() {
                this.classList.remove('border-primary');
            });
            
            dropArea.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('border-primary');
                
                if (e.dataTransfer.files.length > 0) {
                    fileInput.files = e.dataTransfer.files;
                    // Trigger change event
                    const event = new Event('change');
                    fileInput.dispatchEvent(event);
                }
            });
        }
    }
    
    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    if (tabs.length) {
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Here you would typically show/hide content based on the selected tab
                // This is a simplified example - in a real app, you'd have more complex logic
                const tabName = this.textContent.trim().toLowerCase().replace(/\s+/g, '-');
                const tabContents = document.querySelectorAll('.tab-content');
                
                if (tabContents.length) {
                    tabContents.forEach(content => {
                        content.style.display = 'none';
                        if (content.getAttribute('data-tab') === tabName) {
                            content.style.display = 'block';
                        }
                    });
                }
            });
        });
    }
    
    // Recording item selection (for transcript view)
    const recordingItems = document.querySelectorAll('.recording-item');
    if (recordingItems.length) {
        recordingItems.forEach(item => {
            item.addEventListener('click', function() {
                // Remove active class from all items
                recordingItems.forEach(ri => ri.classList.remove('active'));
                // Add active class to clicked item
                this.classList.add('active');
                
                // In a real application, you would load the selected transcript here
                // via AJAX and update the chat panel
                const callId = this.querySelector('.recording-title').textContent;
                window.location.href = '/transcripts/' + callId;
            });
        });
    }
    
    // Function to show notifications
    function showNotification(message, type = 'info') {
        // Check if notification container exists, create it if not
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            container.style.position = 'fixed';
            container.style.top = '1rem';
            container.style.right = '1rem';
            container.style.zIndex = '1000';
            document.body.appendChild(container);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
        notification.style.color = 'white';
        notification.style.padding = '0.75rem 1rem';
        notification.style.borderRadius = '0.375rem';
        notification.style.marginBottom = '0.5rem';
        notification.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.justifyContent = 'space-between';
        
        // Add message
        notification.innerHTML = `
            <span>${message}</span>
            <button style="background: none; border: none; color: white; cursor: pointer; margin-left: 0.5rem;">×</button>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Add close button functionality
        const closeBtn = notification.querySelector('button');
        closeBtn.addEventListener('click', function() {
            notification.remove();
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    // Audio player functionality (for transcript detail view)
    const playButton = document.querySelector('.player-control');
    if (playButton) {
        playButton.addEventListener('click', function() {
            const icon = this.querySelector('svg');
            const iconId = icon.getAttribute('data-feather');
            
            // Toggle between play and pause
            if (iconId === 'play') {
                feather.replace(icon, { 'name': 'pause', 'width': 16, 'height': 16 });
                // In a real implementation, you would start playing the audio here
            } else {
                feather.replace(icon, { 'name': 'play', 'width': 16, 'height': 16 });
                // In a real implementation, you would pause the audio here
            }
        });
        
        // Timeline scrubbing
        const timeline = document.querySelector('.timeline');
        if (timeline) {
            const timelineHandle = document.querySelector('.timeline-handle');
            const timelineProgress = document.querySelector('.timeline-progress');
            
            timeline.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = (x / rect.width) * 100;
                
                timelineProgress.style.width = percent + '%';
                timelineHandle.style.left = percent + '%';
                // In a real implementation, you would seek to the position in the audio
            });
        }
    }
});

// Sidebar mobile toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    // Mobile sidebar functionality
    const sidebar = document.querySelector('.sidebar');
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    // On small screens, close sidebar when a link is clicked
    if (window.innerWidth <= 768) {
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 480) {
                    // For very small screens, we could add a collapsible behavior here
                }
            });
        });
    }
    
    // Add active class to current nav link
    const currentPath = window.location.pathname;
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || 
            (href !== '/' && currentPath.startsWith(href))) {
            link.classList.add('active');
        }
    });
});