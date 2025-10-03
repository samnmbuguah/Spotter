import { useState, useCallback } from 'react';
import { z, ZodError, ZodTypeAny } from 'zod';
import { toast } from 'react-toastify';

type FormErrors<T> = Partial<Record<keyof T, string>>;

export const useForm = <T extends Record<string, any>>(
  initialValues: T,
  validationSchema?: z.ZodSchema<T>,
  onSubmit?: (values: T) => Promise<void> | void
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      
      // Handle different input types
      let finalValue: any = value;
      
      if (type === 'number') {
        finalValue = value === '' ? '' : Number(value);
      } else if (type === 'checkbox') {
        finalValue = (e.target as HTMLInputElement).checked;
      }
      
      setValues((prev) => ({
        ...prev,
        [name]: finalValue,
      }));
      
      // Clear error when user starts typing
      if (errors[name as keyof T]) {
        setErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }
    },
    [errors]
  );

  // Validate form using the provided schema
  const validateForm = useCallback((): boolean => {
    if (!validationSchema) return true;
    
    try {
      validationSchema.parse(values);
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof ZodError) {
        const newErrors: FormErrors<T> = {};
        
        // Handle Zod errors
        if (err.issues) {
          err.issues.forEach((issue: { path?: (string | number)[]; message: string }) => {
            const path = issue.path?.[0] as keyof T | undefined;
            if (path && typeof path === 'string') {
              newErrors[path] = issue.message;
            }
          });
        }
        
        setErrors(newErrors);
        
        // Scroll to the first error
        const firstError = Object.keys(newErrors)[0];
        if (firstError) {
          const element = document.querySelector(`[name="${firstError}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        
        return false;
      }
      return false;
    }
  }, [values, validationSchema]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      
      if (!validateForm()) {
        toast.error('Please fix the form errors before submitting.');
        return;
      }
      
      if (!onSubmit) return;
      
      try {
        setIsSubmitting(true);
        await onSubmit(values);
      } catch (error) {
        console.error('Form submission error:', error);
        toast.error('An error occurred while submitting the form. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, validateForm, values]
  );

  // Set a field value programmatically
  const setFieldValue = useCallback((name: keyof T, value: any) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  // Set a field error programmatically
  const setFieldError = useCallback((name: keyof T, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  }, []);

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setFieldValue,
    setFieldError,
    resetForm,
    setValues,
  };
};

// Utility function to create validation schemas
export const createValidationSchema = <T extends Record<string, ZodTypeAny>>(schema: T) => {
  return z.object(schema);
};
