export interface UserFormData {
  username: string;
  full_name: string;
  role: string;
  password: string;
  password_confirm: string;
  is_active: boolean;
}

export const emptyUserForm: UserFormData = {
  username: '',
  full_name: '',
  role: 'employee',
  password: '',
  password_confirm: '',
  is_active: true,
};
