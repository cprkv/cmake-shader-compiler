
typedef float2 vec2;

typedef struct
{
  float2 a;
  vec2   b;
} vec4;

struct TestStruct
{
  int     s1;
  uint    s2;
  float   s3;
  bool    s4;

  float2  v1;
  float3  v2;
  float4  v3;
  vec2    v4;
  vec4    v5;
  double  v6;
  double2 v7;
  double3 v8;
  bool3   v9;

  int1x1    m1; // integer matrix with 1 row,  1 column
  uint4x1   m2; // integer matrix with 4 rows, 1 column
  bool1x4   m3; // integer matrix with 1 row, 4 columns
  double3x3 m4; // double matrix with 3 rows, 3 columns
  matrix    m5;
  float2x4  m6;
};

struct PointLight
{
  float3 position;
  float  pad_1;
  float3 color;
  float  specular;
  float  constant_factor;
  float  linear_factor;
  float  quadratic_factor;
  float  pad_2;
};

struct Amogus
{
  PointLight l;
  float4     x;
};

cbuffer PSConstantBuffer
{
  Amogus a;
  Amogus b;

  /*Amogus g_t;
  Amogus g_t3;
  float2 g_t2;*/

  PointLight  g_lights[16];
  uint        g_lights_count;
  //float3      g_amogus[4];
  float3      g_view_pos;
  //TestStruct  g_test_struct;
};

cbuffer ConstantBuffer2
{
  Amogus g_sasa;
  float  g_x;
  float3 g_pad_1;
};

Texture2D    g_gbuffer_diffuse  : register( t0 );
SamplerState g_sampler          : register( s0 );

float4 main( float2 uv : UV ) : SV_TARGET
{
  // return float4( g_gbuffer_diffuse.Sample( g_sampler, uv ).xyz + g_view_pos, 1.0 + g_x );
  return g_sasa.x;
}
