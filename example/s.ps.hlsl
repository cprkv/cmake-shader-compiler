
struct A
{
  float x;
  float3 g_pad_2;
};

struct B
{
  float x;
  float3 g_pad_2;
  A t;
};

cbuffer ConstantBufferS
{
  float3 g_sasa;
  float g_pad_1;
  A m;
  B b;
};

float4 main( float2 uv : UV ) : SV_TARGET
{
  return float4( g_sasa.x, g_sasa.y, g_sasa.z, 0 );
}
