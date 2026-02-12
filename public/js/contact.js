document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('contactForm');
  const sendBtn = form.querySelector('.btn-send');
  const clearBtn = form.querySelector('.btn-clear');

  const fields = ['name', 'email', 'message'];
  fields.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    const errorElement = document.getElementById(`${fieldName}Error`);
    
    field.addEventListener('input', function() {
      validateField(this, errorElement);
    });
    
    field.addEventListener('blur', function() {
      validateField(this, errorElement);
    });
  });

  clearBtn.addEventListener('click', function(e) {
    e.preventDefault();

    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.style.transform = 'scale(1)';
    }, 150);

    fields.forEach(fieldName => {
      const field = document.getElementById(fieldName);
      const errorElement = document.getElementById(`${fieldName}Error`);
      
      field.style.borderColor = '#e1e8ed';
      field.style.backgroundColor = '#f8fafc';
      errorElement.textContent = '';
    });
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    let isValid = true;

    fields.forEach(fieldName => {
      const field = document.getElementById(fieldName);
      const errorElement = document.getElementById(`${fieldName}Error`);
      
      if (!validateField(field, errorElement)) {
        isValid = false;
      }
    });
    
    if (isValid) {
      sendBtn.classList.add('loading');
      sendBtn.textContent = 'Sending...';
      sendBtn.disabled = true;

      setTimeout(() => {
        form.submit();
      }, 1500);
    } 
    else {
      form.classList.add('shake');
      setTimeout(() => {
        form.classList.remove('shake');
      }, 500);
      
      const firstInvalid = fields.find(fieldName => {
        const field = document.getElementById(fieldName);
        return !field.value.trim();
      });
      
      if (firstInvalid) {
        document.getElementById(firstInvalid).focus();
      }
    }
  });

  function validateField(field, errorElement) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    if (!value) {
      errorMessage = 'This field is required';
      isValid = false;
    } else {
      switch(field.id) {
        case 'name':
          if (value.length < 2) {
            errorMessage = 'Name must be at least 2 characters';
            isValid = false;
          } 
          else if (!/^[a-zA-Z\s]+$/.test(value)) {
            errorMessage = 'Name can only contain letters and spaces';
            isValid = false;
          }
          break;
          
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errorMessage = 'Please enter a valid email address';
            isValid = false;
          }
          break;
          
        case 'message':
          if (value.length < 10) {
            errorMessage = 'Message must be at least 10 characters';
            isValid = false;
          } 
          else if (value.length > 500) {
            errorMessage = 'Message must be less than 500 characters';
            isValid = false;
          }
          break;
      }
    }

    if (isValid) {
      field.style.borderColor = '#2ecc71';
      field.style.backgroundColor = '#f0fff4';
      errorElement.textContent = '';
    } else {
      field.style.borderColor = '#e74c3c';
      field.style.backgroundColor = '#fff5f5';
      errorElement.textContent = errorMessage;
    }
    
    return isValid;
  }

  fields.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    
    field.addEventListener('focus', function() {
      this.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.2)';
    });
    
    field.addEventListener('blur', function() {
      this.style.boxShadow = 'none';
    });
  });
});