// Validation utilities

export const required = (value) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return 'This field is required'
  }
  return ''
}

export const minLength = (min) => (value) => {
  if (value && value.length < min) {
    return `Must be at least ${min} characters`
  }
  return ''
}

export const maxLength = (max) => (value) => {
  if (value && value.length > max) {
    return `Must be no more than ${max} characters`
  }
  return ''
}

export const email = (value) => {
  if (!value) return ''
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return 'Invalid email format'
  }
  return ''
}

export const numeric = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  if (isNaN(value)) {
    return 'Must be a valid number'
  }
  return ''
}

export const positiveNumber = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const num = parseFloat(value)
  if (isNaN(num)) {
    return 'Must be a valid number'
  }
  if (num < 0) {
    return 'Value cannot be negative'
  }
  return ''
}

export const positiveInteger = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const num = parseInt(value, 10)
  if (isNaN(num)) {
    return 'Must be a valid whole number'
  }
  if (num <= 0) {
    return 'Value must be greater than 0'
  }
  if (num !== parseFloat(value)) {
    return 'Must be a whole number'
  }
  return ''
}

export const nonNegativeInteger = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const num = parseInt(value, 10)
  if (isNaN(num)) {
    return 'Must be a valid whole number'
  }
  if (num < 0) {
    return 'Value cannot be negative'
  }
  if (num !== parseFloat(value)) {
    return 'Must be a whole number'
  }
  return ''
}

export const date = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) {
    return 'Invalid date format'
  }
  return ''
}

export const min = (minValue) => (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const num = parseFloat(value)
  if (isNaN(num)) return ''
  if (num < minValue) {
    return `Value must be at least ${minValue}`
  }
  return ''
}

export const max = (maxValue) => (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const num = parseFloat(value)
  if (isNaN(num)) return ''
  if (num > maxValue) {
    return `Value must be no more than ${maxValue}`
  }
  return ''
}

// Validate form fields
export const validateForm = (fields, validators) => {
  const errors = {}
  let isValid = true

  Object.keys(fields).forEach((fieldName) => {
    const fieldErrors = []
    const fieldValidators = validators[fieldName] || []

    fieldValidators.forEach((validator) => {
      const error = validator(fields[fieldName])
      if (error) {
        fieldErrors.push(error)
      }
    })

    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors[0] // Show first error
      isValid = false
    }
  })

  return { errors, isValid }
}
