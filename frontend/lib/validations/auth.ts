import { z } from 'zod';

// 로그인 스키마
export const loginSchema = z.object({
  email: z.string()
    .min(1, '이메일을 입력해주세요')
    .email('올바른 이메일 형식이 아닙니다'),
  password: z.string()
    .min(1, '비밀번호를 입력해주세요')
    .min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  rememberMe: z.boolean().optional()
});

// 회원가입 스키마
export const registerSchema = z.object({
  username: z.string()
    .min(1, '아이디를 입력해주세요')
    .min(3, '아이디는 최소 3자 이상이어야 합니다')
    .max(20, '아이디는 최대 20자까지 가능합니다')
    .regex(/^[a-zA-Z0-9_]+$/, '아이디는 영문, 숫자, 언더스코어만 사용 가능합니다'),
  email: z.string()
    .min(1, '이메일을 입력해주세요')
    .email('올바른 이메일 형식이 아닙니다'),
  password: z.string()
    .min(1, '비밀번호를 입력해주세요')
    .min(6, '비밀번호는 최소 6자 이상이어야 합니다')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '비밀번호는 대문자, 소문자, 숫자를 각각 하나 이상 포함해야 합니다'
    ),
  confirmPassword: z.string()
    .min(1, '비밀번호 확인을 입력해주세요'),
  nickname: z.string()
    .min(1, '닉네임을 입력해주세요')
    .min(2, '닉네임은 최소 2자 이상이어야 합니다')
    .max(20, '닉네임은 최대 20자까지 가능합니다'),
  terms: z.boolean().refine(val => val === true, {
    message: '이용약관에 동의해주세요'
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword']
});

// 타입 추론
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
