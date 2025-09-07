import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Studio Collaboration Platform
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          일러스트레이터와 클라이언트를 위한 실시간 협업 플랫폼
        </p>
        <div className="mt-10 flex items-center gap-x-6">
          <Link
            href="/auth/login"
            className="rounded-md bg-gray-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 transition-all"
          >
            시작하기
          </Link>
          <Link href="/about" className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700 transition-all">
            더 알아보기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  )
}