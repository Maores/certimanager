"use client";

interface AutoSubmitSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}

export function AutoSubmitSelect({
  name,
  defaultValue,
  children,
  ...rest
}: AutoSubmitSelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        if (form) form.submit();
      }}
      {...rest}
    >
      {children}
    </select>
  );
}
