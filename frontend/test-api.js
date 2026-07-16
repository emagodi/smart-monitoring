
import axios from 'axios';

async function check() {
  try {
    console.log('Fetching controllers from gateway (8080)...');
    const res = await axios.get('http://localhost:8080/api/v1/controllers');
    console.log('Status:', res.status);
    console.log('Data count:', res.data.length);
  } catch (e) {
    console.log('Error fetching from 8080:', e.message);
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Data:', e.response.data);
    }
  }
}

check();
