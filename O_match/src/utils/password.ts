export const PASSWORD_RULE_MESSAGE = '密码需为8-20位，且必须包含字母和数字';

export const isValidPassword = (password: string): boolean => {
  if (password.length < 8 || password.length > 20) {
    return false;
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
};