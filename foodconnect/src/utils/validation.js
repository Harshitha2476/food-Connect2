export function validateEmail(email) {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email';
  return '';
}

export function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return '';
}

export function validateRequired(value, label = 'This field') {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `${label} is required`;
  }
  return '';
}

export function validateSurplusForm(form) {
  const errors = {};
  if (!form.foodName?.trim()) errors.foodName = 'Food name is required';
  if (!form.category) errors.category = 'Category is required';
  if (!form.quantityKg || Number(form.quantityKg) <= 0) {
    errors.quantityKg = 'Enter a valid quantity in kg';
  }
  if (!form.preparationDate) errors.preparationDate = 'Preparation date is required';
  if (!form.preparationTime) errors.preparationTime = 'Preparation time is required';
  if (!form.storageMethod) errors.storageMethod = 'Storage method is required';
  if (!form.pickupDeadline) errors.pickupDeadline = 'Pickup deadline is required';
  if (!form.location?.trim()) errors.location = 'Canteen location is required';
  return errors;
}

export function validateLogin(form) {
  const errors = {};
  const e = validateEmail(form.email);
  if (e) errors.email = e;
  const p = validatePassword(form.password);
  if (p) errors.password = p;
  return errors;
}

export function validateRegister(form) {
  const errors = {};
  if (!form.name?.trim()) errors.name = 'Full name is required';
  const e = validateEmail(form.email);
  if (e) errors.email = e;
  const p = validatePassword(form.password);
  if (p) errors.password = p;
  if (!form.phone?.trim()) errors.phone = 'Phone number is required';
  if (!form.organization?.trim()) errors.organization = 'Organization is required';
  if (!form.role) errors.role = 'Please select a role';
  return errors;
}
