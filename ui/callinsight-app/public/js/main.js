document.addEventListener('DOMContentLoaded', function() {
    // Initialize Feather icons
    feather.replace();
    
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
                // You can add file upload logic here
                console.log('Files selected:', this.files);
            });
            
            // Handle drag and drop
            dropArea.addEventListener('dragover', function(e) {
                e.preventDefault();
                dropArea.classList.add('border-primary');
            });
            
            dropArea.addEventListener('dragleave', function() {
                dropArea.classList.remove('border-primary');
            });
            
            dropArea.addEventListener('drop', function(e) {
                e.preventDefault();
                dropArea.classList.remove('border-primary');
                if (e.dataTransfer.files.length) {
                    fileInput.files = e.dataTransfer.files;
                    console.log('Files dropped:', e.dataTransfer.files);
                    // You can trigger upload here
                }
            });
        }
    }
    
    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    if (tabs.length) {
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                // You can add tab content switching logic here
            });
        });
    }
    
    // Recording item selection
    const recordingItems = document.querySelectorAll('.recording-item');
    if (recordingItems.length) {
        recordingItems.forEach(item => {
            item.addEventListener('click', function() {
                recordingItems.forEach(ri => ri.classList.remove('active'));
                this.classList.add('active');
                // Handle recording selection logic here
            });
        });
    }
});