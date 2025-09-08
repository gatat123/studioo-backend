'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: API 호출 구현 필요
      // const response = await authAPI.forgotPassword(data.email);
      
      // 임시로 2초 후 성공으로 처리
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || '비밀번호 재설정 요청에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-6 text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold">이메일을 확인하세요</CardTitle>
              <CardDescription>
                {getValues('email')}로 비밀번호 재설정 링크를 보내드렸습니다.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>• 이메일이 도착하는 데 몇 분이 걸릴 수 있습니다.</p>
                <p>• 스팸 폴더도 확인해보세요.</p>
                <p>• 링크는 24시간 동안 유효합니다.</p>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col space-y-4">
              <Link href="/auth/login" className="w-full">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  로그인으로 돌아가기
                </Button>
              </Link>
              
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setError(null);
                }}
                className="text-sm text-primary hover:underline"
              >
                다른 이메일로 재시도
              </button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center">비밀번호 찾기</CardTitle>
            <CardDescription className="text-center">
              가입했던 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="가입했던 이메일을 입력하세요"
                  {...register('email')}
                  disabled={isLoading}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    전송 중...
                  </>
                ) : (
                  '재설정 링크 보내기'
                )}
              </Button>
              
              <Link href="/auth/login" className="w-full">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  로그인으로 돌아가기
                </Button>
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}