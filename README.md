# aws-lambda-edge-image-resizer

## Explanation
Nodejs 14 기반 Lambda@Edge 이미지 리사이징 함수로 CloudFront로 이미지 요청시 요청한 이미지를 리사이징하여 CloudFront에 캐싱 및 클라이언트에게 전달한다.
w(넓이), h(높이), q(퀄리티)를 인자로 받으며 w, h는 필수 값이고 q는 10부터 95까지 값을 받으며 생략시 디폴트 값은 95이다.
GitHub Actions을 이용하여 .zip 파일로 Lambda에 업로드한다.

## How to use
GitHub Actions에서 OIDC 방식으로 AWS에 로그인 하므로 CD.yaml에 해당 IAM Role ARN을 넣는다.
해당 repository의 secret에 키를 BUCKET_NAME, 값을 버킷 이름으로 해서 등록한다.

## On AWS
Lambda는 버지니아 북부(us-east-1)에 생성해야 한다.

다음 IAM Policy(정책)을 만들고 Lambda IAM Role(역할)에 추가한다.
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Statement1",
            "Effect": "Allow",
            "Action": [
                "iam:CreateServiceLinkedRole",
                "lambda:GetFunction",
                "lambda:EnableReplication",
                "cloudfront:UpdateDistribution",
                "s3:GetObject",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams"
            ],
            "Resource": "*"
        }
    ]
}
```

Lambda IAM Role의 신뢰관계를 다음과 같이 지정한다.
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": [
                    "edgelambda.amazonaws.com",
                    "lambda.amazonaws.com"
                ]
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

Bucket 정책에 CloudFront와 Lambda에 대한 권한을 추가한다.
```
{
	"Version": "2008-10-17",
	"Id": "PolicyForCloudFrontPrivateContent",
	"Statement": [
		{
			"Sid": "AllowCloudFrontServicePrincipal",
			"Effect": "Allow",
			"Principal": {
				"Service": "cloudfront.amazonaws.com"
			},
			"Action": "s3:GetObject",
			"Resource": "arn:aws:s3:::<S3_BUCKET_NAME>/*",
			"Condition": {
				"StringEquals": {
					"AWS:SourceArn": <CloudFront IAM Role ARN>
				}
			}
		},
		{
			"Sid": "AllowLambdaEdgeToResizeImage",
			"Effect": "Allow",
			"Principal": {
				"AWS": <Lambda IAM Role ARN>
			},
			"Action": [
				"s3:GetObject",
				"s3:PutObject" # 1MB 초과 이미지에 대해 리사이징 후 S3 저장시에 필요
			],
			"Resource": "arn:aws:s3:::<S3_BUCKET_NAME>/*"
		}
	]
}
```

CloudFront 동작이 캐시 및 원본 요청에서 Legacy cache settings 선택 후 쿼리 문자열을 지정된 모두 혹은 쿼리 문자열 포함을 선택한다.
쿼리 문자열 포함을 선택하면 index.js에서 사용하는 쿼리 키들(w, h, q)을 추가한다.