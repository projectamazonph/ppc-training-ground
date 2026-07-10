// Type declaration for paymongo module (no official types exist).
// Using `any` is safe here because we wrap all SDK calls in typed functions.
declare module 'paymongo' {
  const Paymongo: any;
  export default Paymongo;
}