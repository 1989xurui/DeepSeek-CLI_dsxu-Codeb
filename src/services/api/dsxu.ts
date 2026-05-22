// DSXU model API facade.
//
// The implementation below still reuses the mature provider-derived transport
// semantics while DSXU/DeepSeek policy is applied inside the model layer. New
// DSXU mainline code should import this facade instead of the provider migration
// transport so product runtime code does not grow provider-named call surfaces.
export * from './dsxuTransport.js'
