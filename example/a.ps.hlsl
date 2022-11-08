struct PointLight
{
  float3 position;
  float  _pad_1;
  float3 color;
  float  specular;
  float  constant_factor;
  float  linear_factor;
  float  quadratic_factor;
  float  _pad_2;
};

cbuffer AShaderPSConstantBuffer
{
  PointLight  g_lights[16];
  uint        g_lights_count;
  float3      g_view_pos;
};

Texture2D    g_gbuffer_diffuse  : register( t0 );
SamplerState g_sampler          : register( s0 );

float4 main( float2 uv : UV ) : SV_TARGET
{
  return float4( g_gbuffer_diffuse.Sample( g_sampler, uv ).xyz + g_view_pos, 1.0 );
}
