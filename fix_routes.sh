#!/bin/bash

# Fix all route files with dynamic params
files=(
  "app/api/tasks/[id]/route.ts"
  "app/api/tasks/[id]/status/route.ts"
  "app/api/tasks/[projectId]/route.ts"
  "app/api/todos/[id]/complete/route.ts"
  "app/api/todos/[id]/route.ts"
  "app/api/todos/[projectId]/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    
    # Extract param name from path
    if [[ $file =~ \[([^\]]+)\] ]]; then
      param_name="${BASH_REMATCH[1]}"
      
      # Fix function signatures and add await params
      sed -i "s/{ params }: { params: { ${param_name}: string } }/{ params }: { params: Promise<{ ${param_name}: string }> }/g" "$file"
      
      # Add the await line after function declaration
      sed -i "/{ params }: { params: Promise<{ ${param_name}: string }> }/ {
        n
        s/) {/) {\n  const { ${param_name} } = await params;/
      }" "$file"
      
      # Replace params.id or params.projectId with just id or projectId
      sed -i "s/params\.${param_name}/${param_name}/g" "$file"
    fi
  fi
done

echo "All files fixed!"
