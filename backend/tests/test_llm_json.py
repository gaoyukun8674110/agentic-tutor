import unittest

from app.utils.llm_json import extract_json_block, strip_json_blocks


class LLMJsonTests(unittest.TestCase):
    def test_extract_none_returns_none(self):
        self.assertIsNone(extract_json_block(None))

    def test_extract_empty_returns_none(self):
        self.assertIsNone(extract_json_block(""))

    def test_extract_fenced_json_object(self):
        self.assertEqual(
            extract_json_block('前文\n```json\n{"a": 1, "b": "x"}\n```\n后文'),
            {"a": 1, "b": "x"},
        )

    def test_extract_inline_json_object(self):
        self.assertEqual(
            extract_json_block('说明 {"error_type": "concept_error", "skills": []} 结尾'),
            {"error_type": "concept_error", "skills": []},
        )

    def test_extract_without_json_returns_none(self):
        self.assertIsNone(extract_json_block("没有任何 json"))

    def test_extract_list_returns_none(self):
        self.assertIsNone(extract_json_block("[1, 2, 3]"))

    def test_strip_fenced_json_blocks(self):
        self.assertEqual(strip_json_blocks('诊断正文\n```json\n{"a": 1}\n```'), "诊断正文")


if __name__ == "__main__":
    unittest.main()
