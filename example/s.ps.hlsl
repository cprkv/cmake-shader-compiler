
struct A
{
  float x;
  float3 _pad_1;
};

struct B
{
  float x;
  float3 _pad_1;
  A t;
};

cbuffer SSHaderPSConstantBuffer
{
  float3 g_sasa;
  float _pad_1;
  A m;
  B b;
  float2x2 f2x2;
  float2 _pad_2;
  float3x3 f3x3;
  float _pad_3;
  float4x4 f4x4;
  matrix   f4x4matrix;
};

float4 main( float2 uv : UV ) : SV_TARGET
{
  return float4( g_sasa.x, g_sasa.y, g_sasa.z, 0 );
}
