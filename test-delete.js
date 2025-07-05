import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3001';

async function testDelete() {
  try {
    // First, get the list of files
    console.log('Getting list of files...');
    const filesResponse = await fetch(`${API_BASE_URL}/api/files`);
    const filesData = await filesResponse.json();
    
    if (filesData.files.length === 0) {
      console.log('No files found to delete');
      return;
    }
    
    const testFile = filesData.files[0];
    console.log('Testing deletion of:', testFile.filename);
    
    // Test delete with password
    const deleteResponse = await fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(testFile.filename)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        password: process.env.UPLOAD_PASSWORD || 'test-password' 
      }),
    });
    
    console.log('Delete response status:', deleteResponse.status);
    const deleteData = await deleteResponse.json();
    console.log('Delete response:', deleteData);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDelete(); 