// 단순한 export 방식으로 변경
export const GET = withAuth(getAnnotation);
export const PUT = withAuth(updateAnnotation);
export const DELETE = withAuth(deleteAnnotation);
