const fs = require('fs'); const path = require('path');  
fs.mkdirSync(path.join('app','forgot-password'), { recursive: true });  
fs.mkdirSync(path.join('app','reset-password','[token]'), { recursive: true });  
console.log('Dirs created');  
